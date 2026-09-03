import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../../common/constants';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(
    teacherId: string,
    data: { title: string; description?: string; category?: string },
  ) {
    return this.prisma.course.create({
      data: { ...data, teacherId },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    publishedOnly?: boolean;
  }) {
    const { page = 1, limit = 20, search, category, publishedOnly } = params;
    const where: Prisma.CourseWhereInput = {};
    if (publishedOnly) where.isPublished = true;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { lessons: true, enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.course.findMany({
      where: { teacherId },
      include: { _count: { select: { lessons: true, enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lessons: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { materials: true, quizzes: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async update(
    id: string,
    userId: string,
    userRole: Role,
    data: {
      title?: string;
      description?: string;
      category?: string;
      thumbnail?: string;
    },
  ) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.teacherId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Not authorized to edit this course');
    }
    return this.prisma.course.update({ where: { id }, data });
  }

  async togglePublish(id: string, userId: string, userRole: Role) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.teacherId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Not authorized');
    }
    return this.prisma.course.update({
      where: { id },
      data: { isPublished: !course.isPublished },
    });
  }

  async delete(id: string, userId: string, userRole: Role) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.teacherId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Not authorized');
    }
    return this.prisma.course.delete({ where: { id } });
  }
}

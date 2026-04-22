import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../../common/constants';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, userRole: Role, courseId: string, data: { title: string; content?: string; videoUrl?: string; order?: number }) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');

    const maxOrder = await this.prisma.lesson.findFirst({
      where: { courseId }, orderBy: { order: 'desc' }, select: { order: true },
    });

    return this.prisma.lesson.create({
      data: { ...data, courseId, order: data.order ?? (maxOrder ? maxOrder.order + 1 : 0) },
    });
  }

  async findByCourse(courseId: string) {
    return this.prisma.lesson.findMany({
      where: { courseId },
      include: { _count: { select: { materials: true, quizzes: true } } },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        materials: true,
        quizzes: { include: { _count: { select: { questions: true } } } },
        course: { select: { id: true, title: true, teacherId: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async update(id: string, userId: string, userRole: Role, data: { title?: string; content?: string; videoUrl?: string; order?: number }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id }, include: { course: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    return this.prisma.lesson.update({ where: { id }, data });
  }

  async delete(id: string, userId: string, userRole: Role) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id }, include: { course: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    return this.prisma.lesson.delete({ where: { id } });
  }

  async reorder(courseId: string, lessonIds: string[]) {
    const updates = lessonIds.map((id, index) =>
      this.prisma.lesson.update({ where: { id }, data: { order: index } }),
    );
    return this.prisma.$transaction(updates);
  }
}

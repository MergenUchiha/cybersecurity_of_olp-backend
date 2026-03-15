import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post(':courseId')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Param('courseId') courseId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: { title: string; content?: string; videoUrl?: string; order?: number },
  ) {
    return this.lessonsService.create(userId, role, courseId, dto);
  }

  @Get('course/:courseId')
  async findByCourse(@Param('courseId') courseId: string) {
    return this.lessonsService.findByCourse(courseId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: { title?: string; content?: string; videoUrl?: string; order?: number },
  ) {
    return this.lessonsService.update(id, userId, role, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.lessonsService.delete(id, userId, role);
  }

  @Patch('course/:courseId/reorder')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async reorder(
    @Param('courseId') courseId: string,
    @Body() dto: { lessonIds: string[] },
  ) {
    return this.lessonsService.reorder(courseId, dto.lessonIds);
  }
}

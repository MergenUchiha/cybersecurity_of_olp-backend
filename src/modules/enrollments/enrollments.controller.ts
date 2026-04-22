import { Controller, Post, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants';

@ApiTags('enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':courseId')
  async enroll(
    @CurrentUser('sub') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.enroll(studentId, courseId);
  }

  @Delete(':courseId')
  async unenroll(
    @CurrentUser('sub') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.unenroll(studentId, courseId);
  }

  @Get('my-courses')
  async getMyEnrollments(@CurrentUser('sub') studentId: string) {
    return this.enrollmentsService.getStudentEnrollments(studentId);
  }

  @Get('course/:courseId')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async getCourseEnrollments(@Param('courseId') courseId: string) {
    return this.enrollmentsService.getCourseEnrollments(courseId);
  }

  @Get('check/:courseId')
  async checkEnrollment(
    @CurrentUser('sub') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    const enrolled = await this.enrollmentsService.isEnrolled(studentId, courseId);
    return { enrolled };
  }
}

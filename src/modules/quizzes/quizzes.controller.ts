import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants';

@ApiTags('quizzes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('lesson/:lessonId')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: { title: string; description?: string; passingScore?: number; timeLimit?: number },
  ) {
    return this.quizzesService.create(userId, role, lessonId, dto);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('role') role: Role,
  ) {
    if (role === Role.STUDENT) {
      return this.quizzesService.findOneForStudent(id);
    }
    return this.quizzesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: { title?: string; description?: string; passingScore?: number },
  ) {
    return this.quizzesService.update(id, userId, role, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.quizzesService.delete(id, userId, role);
  }

  // Questions
  @Post(':quizId/questions')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async addQuestion(
    @Param('quizId') quizId: string,
    @Body() dto: { text: string; order?: number; answerOptions: { text: string; isCorrect: boolean }[] },
  ) {
    return this.quizzesService.addQuestion(quizId, dto);
  }

  @Delete('questions/:questionId')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.quizzesService.deleteQuestion(questionId);
  }

  // Attempts
  @Post(':quizId/submit')
  async submitAttempt(
    @Param('quizId') quizId: string,
    @CurrentUser('sub') studentId: string,
    @Body() dto: { answers: { questionId: string; selectedOptionId: string }[] },
  ) {
    return this.quizzesService.submitAttempt(quizId, studentId, dto.answers);
  }

  @Get(':quizId/attempts')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async getAttempts(@Param('quizId') quizId: string) {
    return this.quizzesService.getAttempts(quizId);
  }

  @Get('my-attempts/all')
  async getMyAttempts(@CurrentUser('sub') studentId: string) {
    return this.quizzesService.getStudentAttempts(studentId);
  }

  @Get('attempts/:attemptId')
  async getAttemptDetails(@Param('attemptId') attemptId: string) {
    return this.quizzesService.getAttemptDetails(attemptId);
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, userRole: Role, lessonId: string, data: { title: string; description?: string; passingScore?: number; timeLimit?: number }) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');

    return this.prisma.quiz.create({ data: { ...data, lessonId } });
  }

  async findOne(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { answerOptions: true } },
        lesson: { select: { id: true, title: true, courseId: true } },
        _count: { select: { attempts: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  // For students - hide correct answers
  async findOneForStudent(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { answerOptions: { select: { id: true, text: true } } },
        },
        lesson: { select: { id: true, title: true, courseId: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async update(id: string, userId: string, userRole: Role, data: { title?: string; description?: string; passingScore?: number; timeLimit?: number }) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: { lesson: { include: { course: true } } } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.lesson.course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    return this.prisma.quiz.update({ where: { id }, data });
  }

  async delete(id: string, userId: string, userRole: Role) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: { lesson: { include: { course: true } } } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.lesson.course.teacherId !== userId && userRole !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    return this.prisma.quiz.delete({ where: { id } });
  }

  // Question management
  async addQuestion(quizId: string, data: { text: string; order?: number; answerOptions: { text: string; isCorrect: boolean }[] }) {
    return this.prisma.question.create({
      data: {
        quizId,
        text: data.text,
        order: data.order ?? 0,
        answerOptions: { create: data.answerOptions },
      },
      include: { answerOptions: true },
    });
  }

  async updateQuestion(questionId: string, data: { text?: string; order?: number }) {
    return this.prisma.question.update({ where: { id: questionId }, data });
  }

  async deleteQuestion(questionId: string) {
    return this.prisma.question.delete({ where: { id: questionId } });
  }

  // Quiz attempt
  async submitAttempt(quizId: string, studentId: string, answers: { questionId: string; selectedOptionId: string }[]) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { answerOptions: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    // Calculate score
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

    for (const answer of answers) {
      const question = quiz.questions.find(q => q.id === answer.questionId);
      if (!question) continue;
      const selectedOption = question.answerOptions.find(o => o.id === answer.selectedOptionId);
      if (selectedOption?.isCorrect) correctCount++;
    }

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const passed = score >= quiz.passingScore;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
        score,
        totalScore: totalQuestions,
        passed,
        submittedAt: new Date(),
        answers: {
          create: answers.map(a => ({
            questionId: a.questionId,
            selectedOptionId: a.selectedOptionId,
          })),
        },
      },
      include: { answers: true },
    });

    return { ...attempt, correctCount, totalQuestions };
  }

  async getAttempts(quizId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getStudentAttempts(studentId: string, quizId?: string) {
    const where: any = { studentId };
    if (quizId) where.quizId = quizId;

    return this.prisma.quizAttempt.findMany({
      where,
      include: {
        quiz: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getAttemptDetails(attemptId: string) {
    return this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: { include: { questions: { include: { answerOptions: true } } } },
        answers: { include: { question: true, selectedOption: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}

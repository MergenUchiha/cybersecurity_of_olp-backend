import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

// Database
import { DatabaseModule } from './database/database.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { SecurityEventsModule } from './modules/security-events/security-events.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { VideoCallsModule } from './modules/video-calls/video-calls.module';
import { TurnModule } from './modules/turn/turn.module';

// Config
import { loadEnv } from './config/env.validation';

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: loadEnv().THROTTLE_TTL,
        limit: loadEnv().THROTTLE_LIMIT,
      },
    ]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    QuizzesModule,
    EnrollmentsModule,
    SecurityEventsModule,
    SessionsModule,
    AuditLogsModule,
    AnalyticsModule,
    VideoCallsModule,
    TurnModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

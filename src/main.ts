import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { loadEnv } from './config/env.validation';

/**
 * Allowed origins come from CORS_ORIGINS. They used to be a hardcoded list
 * that included a production IP address, which both leaked the server and
 * meant a redeploy elsewhere needed a code change.
 */
function corsOrigin(raw: string, isProduction: boolean) {
  const allowList = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) return callback(null, true);
    if (allowList.includes(origin)) return callback(null, true);
    if (!isProduction && localhost.test(origin)) return callback(null, true);
    // Withholding the header is what CORS asks for; answering with an error
    // would turn every unknown origin into a 500.
    return callback(null, false);
  };
}

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  app.enableCors({
    origin: corsOrigin(env.CORS_ORIGINS, env.NODE_ENV === 'production'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // The filter existed but was never registered, so unhandled errors fell
  // through to Nest's default handling.
  app.useGlobalFilters(new AllExceptionsFilter(env.NODE_ENV === 'production'));

  // The reference lists every route and payload shape, so it stays behind a
  // flag that defaults to off.
  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Secure LMS API')
      .setDescription('Online learning platform with security auditing')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('courses', 'Course management')
      .addTag('lessons', 'Lesson management')
      .addTag('quizzes', 'Quiz management')
      .addTag('security', 'Security events')
      .addTag('analytics', 'Security analytics')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
    logger.log(`Swagger UI on http://localhost:${env.PORT}/api/docs`);
  }

  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`Server running on http://0.0.0.0:${env.PORT}`);
}

void bootstrap();

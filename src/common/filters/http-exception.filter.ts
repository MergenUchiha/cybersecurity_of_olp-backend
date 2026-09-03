import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body
      ) {
        const raw = (body as { message: unknown }).message;
        if (typeof raw === 'string') message = raw;
        else if (Array.isArray(raw)) message = raw.map((m) => String(m));
      }
    } else if (exception instanceof Error && !this.isProduction) {
      // An unhandled error can name a table, a file or a connection string,
      // so in production the client is told nothing beyond the status.
      message = exception.message;
    }

    // A 4xx is an ordinary answer, not something worth a stack trace; only
    // a real failure gets one.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

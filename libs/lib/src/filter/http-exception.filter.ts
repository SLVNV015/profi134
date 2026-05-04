import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { normalizeError, logException } from './base-exception.filter';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.resolve(exception, request);
    const normalized = normalizeError(exception);

    logException(this.logger, normalized, 'HTTP');

    response.status(status).json(body);
  }

  private resolve(
    exception: unknown,
    request: Request,
  ): { status: number; body: object } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      return {
        status,
        body: {
          statusCode: status,
          ...(typeof res === 'string' ? { message: res } : (res as object)),
          path: request.url,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

import { Logger } from '@nestjs/common';

export interface NormalizedError {
  message: string;
  stack?: string;
  code?: string;
}

export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof Error) {
    return {
      message: exception.message,
      stack: exception.stack,
      code: (exception as any).code,
    };
  }

  if (typeof exception === 'string') {
    return { message: exception };
  }

  if (typeof exception === 'object' && exception !== null) {
    return { message: JSON.stringify(exception) };
  }

  return { message: 'Unknown error' };
}

export function logException(
  logger: Logger,
  normalized: NormalizedError,
  context: string,
): void {
  logger.error(`[${context}] ${normalized.message}`, normalized.stack);
}

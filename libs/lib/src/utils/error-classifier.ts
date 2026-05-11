import { ZodError } from 'zod';

export enum ErrorType {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  BUSINESS = 'BUSINESS',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorContext {
  type: ErrorType;
  message: string;
  code?: string;
  stack?: string;
  retryable: boolean;
  metadata?: Record<string, any>;
}

const SLONIK_NETWORK_ERRORS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
];

const SLONIK_RETRYABLE_ERRORS = [
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08003', // connection_does_not_exist
];

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message;
  const code = (error as any).code;

  const networkCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_FAIL',
    'EPIPE',
  ];

  if (code && networkCodes.includes(code)) return true;

  const networkPatterns = [
    'socket hang up',
    'connect ECONNREFUSED',
    'getaddrinfo ENOTFOUND',
    'timeout',
  ];

  return networkPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

export function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const errorName = error.constructor.name;
  const code = (error as any).code;

  if (
    errorName.includes('Slonik') ||
    errorName === 'NotFoundError' ||
    errorName === 'DataIntegrityError' ||
    errorName === 'IntegrityConstraintViolationError' ||
    errorName === 'CheckIntegrityConstraintViolationError' ||
    errorName === 'ForeignKeyIntegrityConstraintViolationError' ||
    errorName === 'NotNullIntegrityConstraintViolationError' ||
    errorName === 'UniqueIntegrityConstraintViolationError'
  ) {
    return true;
  }

  if (code && /^[0-9A-Z]{5}$/i.test(code)) {
    return true;
  }

  return false;
}

export function isDatabaseRetryable(error: unknown): boolean {
  if (!isDatabaseError(error)) return false;

  const code = (error as any).code;
  const message = (error as Error).message;

  if (code && SLONIK_RETRYABLE_ERRORS.includes(code)) {
    return true;
  }

  if (
    SLONIK_NETWORK_ERRORS.some(
      (netErr) => code === netErr || message.includes(netErr),
    )
  ) {
    return true;
  }

  return false;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof ZodError;
}

export function classifyError(error: unknown): ErrorContext {
  if (isValidationError(error)) {
    const zodError = error as ZodError;
    return {
      type: ErrorType.VALIDATION,
      message: 'Validation failed',
      retryable: false,
      metadata: {
        issues: zodError.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    };
  }

  if (isDatabaseError(error)) {
    const err = error as Error;
    const code = (err as any).code;
    const retryable = isDatabaseRetryable(error);

    return {
      type: ErrorType.DATABASE,
      message: err.message,
      code,
      stack: err.stack,
      retryable,
      metadata: {
        errorName: err.constructor.name,
      },
    };
  }

  if (isNetworkError(error)) {
    const err = error as Error;
    return {
      type: ErrorType.NETWORK,
      message: err.message,
      code: (err as any).code,
      stack: err.stack,
      retryable: true,
    };
  }
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN,
      message: error.message,
      stack: error.stack,
      retryable: false,
    };
  }

  return {
    type: ErrorType.UNKNOWN,
    message: String(error),
    retryable: false,
  };
}

export function isRetryableError(error: unknown): boolean {
  const context = classifyError(error);
  return context.retryable;
}

export function formatErrorForLog(error: unknown): string {
  const context = classifyError(error);

  let message = `[${context.type}] ${context.message}`;

  if (context.code) {
    message += ` (code: ${context.code})`;
  }

  if (context.metadata) {
    message += `\nMetadata: ${JSON.stringify(context.metadata, null, 2)}`;
  }

  return message;
}

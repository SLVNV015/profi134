import {
  classifyError,
  ErrorType,
  isNetworkError,
  isDatabaseError,
  isDatabaseRetryable,
  isValidationError,
  isRetryableError,
  formatErrorForLog,
} from './error-classifier';
import { ZodError, z } from 'zod';

describe('Error Classifier', () => {
  describe('isNetworkError', () => {
    it('должен определить ECONNREFUSED как сетевую ошибку', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5672');
      (error as any).code = 'ECONNREFUSED';
      expect(isNetworkError(error)).toBe(true);
    });

    it('должен определить ETIMEDOUT как сетевую ошибку', () => {
      const error = new Error('Connection timeout');
      (error as any).code = 'ETIMEDOUT';
      expect(isNetworkError(error)).toBe(true);
    });

    it('должен определить socket hang up как сетевую ошибку', () => {
      const error = new Error('socket hang up');
      expect(isNetworkError(error)).toBe(true);
    });

    it('не должен определить обычную ошибку как сетевую', () => {
      const error = new Error('Something went wrong');
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('isDatabaseError', () => {
    it('должен определить Slonik ошибку', () => {
      class SlonikError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'SlonikError';
        }
      }
      const error = new SlonikError('Query failed');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('должен определить PostgreSQL ошибку по коду', () => {
      const error = Object.assign(new Error('Deadlock detected'), {
        code: '40P01',
      });
      expect(isDatabaseError(error)).toBe(true);
    });

    it('должен определить NotFoundError', () => {
      class NotFoundError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'NotFoundError';
        }
      }
      const error = new NotFoundError('Row not found');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('не должен определить обычную ошибку как ошибку БД', () => {
      const error = new Error('Something went wrong');
      expect(isDatabaseError(error)).toBe(false);
    });
  });

  describe('isDatabaseRetryable', () => {
    it('должен определить deadlock как retryable', () => {
      const error = Object.assign(new Error('Deadlock detected'), {
        code: '40P01',
      });
      expect(isDatabaseRetryable(error)).toBe(true);
    });

    it('должен определить serialization_failure как retryable', () => {
      const error = Object.assign(new Error('Serialization failure'), {
        code: '40001',
      });
      expect(isDatabaseRetryable(error)).toBe(true);
    });

    it('должен определить connection_failure как retryable', () => {
      const error = Object.assign(new Error('Connection failure'), {
        code: '08006',
      });
      expect(isDatabaseRetryable(error)).toBe(true);
    });

    it('не должен определить unique constraint как retryable', () => {
      const error = Object.assign(new Error('Unique constraint violation'), {
        code: '23505',
      });
      expect(isDatabaseRetryable(error)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('должен определить ZodError', () => {
      const schema = z.object({ name: z.string() });
      try {
        schema.parse({ name: 123 });
      } catch (error) {
        expect(isValidationError(error)).toBe(true);
      }
    });

    it('не должен определить обычную ошибку как валидационную', () => {
      const error = new Error('Something went wrong');
      expect(isValidationError(error)).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('должен классифицировать ZodError как VALIDATION', () => {
      const schema = z.object({ name: z.string() });
      try {
        schema.parse({ name: 123 });
      } catch (error) {
        const context = classifyError(error);
        expect(context.type).toBe(ErrorType.VALIDATION);
        expect(context.retryable).toBe(false);
        expect(context.metadata?.issues).toBeDefined();
      }
    });

    it('должен классифицировать deadlock как DATABASE retryable', () => {
      const error = Object.assign(new Error('Deadlock detected'), {
        code: '40P01',
      });
      const context = classifyError(error);
      expect(context.type).toBe(ErrorType.DATABASE);
      expect(context.retryable).toBe(true);
      expect(context.code).toBe('40P01');
    });

    it('должен классифицировать unique constraint как DATABASE non-retryable', () => {
      const error = Object.assign(new Error('Unique constraint violation'), {
        code: '23505',
      });
      const context = classifyError(error);
      expect(context.type).toBe(ErrorType.DATABASE);
      expect(context.retryable).toBe(false);
    });

    it('должен классифицировать ECONNREFUSED как NETWORK retryable', () => {
      const error = Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
      const context = classifyError(error);
      expect(context.type).toBe(ErrorType.NETWORK);
      expect(context.retryable).toBe(true);
    });

    it('должен классифицировать обычную ошибку как UNKNOWN', () => {
      const error = new Error('Something went wrong');
      const context = classifyError(error);
      expect(context.type).toBe(ErrorType.UNKNOWN);
      expect(context.retryable).toBe(false);
    });

    it('должен обработать строку как ошибку', () => {
      const context = classifyError('String error');
      expect(context.type).toBe(ErrorType.UNKNOWN);
      expect(context.message).toBe('String error');
    });
  });

  describe('isRetryableError', () => {
    it('должен вернуть true для сетевых ошибок', () => {
      const error = Object.assign(new Error('ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
      expect(isRetryableError(error)).toBe(true);
    });

    it('должен вернуть true для retryable ошибок БД', () => {
      const error = Object.assign(new Error('Deadlock'), { code: '40P01' });
      expect(isRetryableError(error)).toBe(true);
    });

    it('должен вернуть false для валидационных ошибок', () => {
      const schema = z.object({ name: z.string() });
      try {
        schema.parse({ name: 123 });
      } catch (error) {
        expect(isRetryableError(error)).toBe(false);
      }
    });

    it('должен вернуть false для обычных ошибок', () => {
      const error = new Error('Something went wrong');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('formatErrorForLog', () => {
    it('должен форматировать сетевую ошибку', () => {
      const error = Object.assign(new Error('ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
      const formatted = formatErrorForLog(error);
      expect(formatted).toContain('[NETWORK]');
      expect(formatted).toContain('ECONNREFUSED');
      expect(formatted).toContain('code: ECONNREFUSED');
    });

    it('должен форматировать валидационную ошибку с metadata', () => {
      const schema = z.object({ name: z.string() });
      try {
        schema.parse({ name: 123 });
      } catch (error) {
        const formatted = formatErrorForLog(error);
        expect(formatted).toContain('[VALIDATION]');
        expect(formatted).toContain('Metadata:');
        expect(formatted).toContain('issues');
      }
    });

    it('должен форматировать ошибку БД с кодом', () => {
      const error = Object.assign(new Error('Deadlock detected'), {
        code: '40P01',
      });
      const formatted = formatErrorForLog(error);
      expect(formatted).toContain('[DATABASE]');
      expect(formatted).toContain('code: 40P01');
    });
  });
});

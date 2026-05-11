import { isNetworkError as isNetworkErrorClassifier } from './error-classifier';

/**
 * @deprecated Use error-classifier.ts instead
 * Kept for backward compatibility
 */
export function isNetworkError(error: unknown): boolean {
  return isNetworkErrorClassifier(error);
}


const NETWORK_ERRORS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_FAIL',
  'socket hang up',
  'EPIPE',
];

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    NETWORK_ERRORS.some((networkError) => error.message.includes(networkError))
  );
}

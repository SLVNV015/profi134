export const RedisKey = {
  idempotencyLock: (correlationId: string) =>
    `idempotency:lock:${correlationId}`,
  idempotencyResult: (correlationId: string) =>
    `idempotency:result:${correlationId}`,
  eventLock: (eventId: string) => `event:lock:${eventId}`,
  eventResult: (eventId: string) => `event:result:${eventId}`,
  statsSuccess: () => `stats:success`,
  statsFailure: () => `stats:failure`,
};

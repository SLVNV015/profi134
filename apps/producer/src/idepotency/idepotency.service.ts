import { RedisKey } from '@app/lib/constants/redis-key.constants';
import { REDIS_CLIENT } from '@app/lib/redis/redis.provider';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

export interface IdepotencyRecord {
  status: 'pending' | 'accepted' | 'failed';
  eventId?: string;
  response?: unknown;
  createdAt: number;
}

@Injectable()
export class IdepotencyService {
  private readonly TTL = 24 * 60 * 60;
  private readonly LOCK_TTL = 30;

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async acquireLock(correlationId: string): Promise<boolean> {
    const key = RedisKey.idempotencyLock(correlationId);
    const result = await this.redisClient.set(
      key,
      '1',
      'EX',
      this.LOCK_TTL,
      'NX',
    );
    return result === 'OK';
  }

  async getRecord(correlationId: string): Promise<IdepotencyRecord | null> {
    const key = RedisKey.idempotencyResult(correlationId);
    const result = await this.redisClient.get(key);
    return result ? JSON.parse(result) : null;
  }

  async saveRecord(
    correlationId: string,
    record: IdepotencyRecord,
  ): Promise<void> {
    const key = RedisKey.idempotencyResult(correlationId);
    await this.redisClient.set(key, JSON.stringify(record), 'EX', this.TTL);
  }

  async releaseLock(correlationId: string): Promise<void> {
    const key = RedisKey.idempotencyLock(correlationId);
    await this.redisClient.del(key);
  }
}

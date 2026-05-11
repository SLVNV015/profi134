import { REDIS_CLIENT } from '@app/lib/redis/redis.provider';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class IdepotencyService {
  constructor(@Inject(REDIS_CLIENT) private readonly _client: Redis) {}

  private readonly KEY: string = 'consumer:idempotency:';

  async isDuplicate(id: string) {
    return await this._client.get(this.KEY + id);
  }

  async markAsProcessed(id: string) {
    await this._client.set(this.KEY + id, 'true', 'EX', 60 * 60 * 24);
  }
}

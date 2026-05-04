import { RedisKey } from '@app/lib/constants/redis-key.constants';
import { REDIS_CLIENT } from '@app/lib/redis/redis.provider';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class StorageService {
  constructor(@Inject(REDIS_CLIENT) private readonly _client: Redis) {}

  async incrSucces() {
    const key = RedisKey.statsSuccess();
    await this._client.incr(key);
  }

  async incrFailure() {
    const key = RedisKey.statsFailure();
    await this._client.incr(key);
  }

  async getSuccess() {
    const key = RedisKey.statsSuccess();
    return await this._client.get(key);
  }

  async getFailure() {
    const key = RedisKey.statsFailure();
    return await this._client.get(key);
  }
}

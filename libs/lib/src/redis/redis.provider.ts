import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (cfg: ConfigService): Redis => {
    const client = new Redis({
      host: cfg.get('REDIS_HOST', 'localhost'),
      port: cfg.get('REDIS_PORT', 6379),
      password: cfg.getOrThrow<string>('REDIS_PASSWORD'),
      retryStrategy: (times) => {
        return Math.min(times * 200, 2000);
      },
    });
    client.on('error', (err) => {
      console.error(`[REDIS] err,`, err);
    });
    return client;
  },
};

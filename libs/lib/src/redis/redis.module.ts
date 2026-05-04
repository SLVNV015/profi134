import { Global, Module } from '@nestjs/common';
import { REDIS_CLIENT, redisProvider } from './redis.provider';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

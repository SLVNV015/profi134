import { RedisModule } from '@app/lib/redis/redis.module';
import { Module } from '@nestjs/common';
import { IdepotencyService } from './idepotency.service';

@Module({
  imports: [RedisModule],
  providers: [IdepotencyService],
  exports: [IdepotencyService],
})
export class IdepotencyModule {}

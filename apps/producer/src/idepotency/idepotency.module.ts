import { Module } from '@nestjs/common';
import { IdepotencyService } from './idepotency.service';

@Module({
  providers: [IdepotencyService],
  exports: [IdepotencyService],
})
export class IdepotencyModule {}

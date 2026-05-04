import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { StorageModule } from '../storage/storage.module';
import { RedisModule } from '@app/lib/redis/redis.module';
import { IdepotencyModule } from '../idepotency/idepotency.module';
import { RmqModule } from '../rmq/rmq.module';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  imports: [StorageModule, RedisModule, IdepotencyModule, RmqModule],
})
export class MessagesModule {}

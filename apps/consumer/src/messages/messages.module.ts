import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NotifyModule } from '../notify/notify.module';
import { IdepotencyModule } from '../idemotency/idepotency.module';

@Module({
  imports: [NotifyModule, IdepotencyModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

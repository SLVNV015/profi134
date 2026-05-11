import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { OutBoxModule } from '../outbox/outbox.module';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  imports: [OutBoxModule],
})
export class MessagesModule {}

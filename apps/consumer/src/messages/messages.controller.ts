import { Controller } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { type EventMessage } from '@app/lib/interfaces/event-message.interface';

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @EventPattern('event.process')
  async handleMessage(
    @Payload() event: { data: EventMessage },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.messagesService.process(event.data);

      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, false);
    }
  }

  // @EventPattern('dead.letter')
  // async handleDeadLetter(
  //   @Payload() event: { data: EventMessage },
  //   @Ctx() context: RmqContext,
  // ) {
  //   const channel = context.getChannelRef();
  //   const originalMsg = context.getMessage();
  //
  //   try {
  //     await this.messagesService.processDeadLetter(event.data);
  //
  //     channel.ack(originalMsg);
  //   } catch (error) {
  //     channel.nack(originalMsg, false, false);
  //   }
  // }
}

import { EventMessage } from '@app/lib/interfaces/event-message.interface';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { DlqProcess } from './dlq.process';

@Controller()
export class DlqController {
  constructor(private readonly dlqProcessor: DlqProcess) {}

  @EventPattern('event.process')
  async handleDeadLetter(
    @Payload() event: { data: EventMessage },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    console.log('handleDeadLetter');
    // console.log(event, context);
    try {
      await this.dlqProcessor.processDeadLetter(event.data);

      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, false);
    }
  }
}

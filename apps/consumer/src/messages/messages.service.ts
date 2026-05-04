import { Injectable, Logger } from '@nestjs/common';
import { NotifyService } from '../notify/notify.service';
import { EventMessage } from '@app/lib/interfaces/event-message.interface';

@Injectable()
export class MessagesService {
  constructor(private readonly notifyService: NotifyService) {}
  private readonly logger = new Logger(MessagesService.name);

  async process(event: EventMessage) {
    await this.doTheJob(event);
    const message = [
      `Succes RabbitMq message recieved:`,
      `id=${event.id}`,
      `type=${event.type}`,
      `correlationId=${event.correlationId}`,
      `timestamp=${new Date(event.timestamp)}`,
      `data=${JSON.stringify(event.payload, null, 2)}`,
    ];
    await this.notifyService.notify(message.join('\n'));
  }

  private async doTheJob(event: EventMessage) {
    setTimeout(() => {
      this.logger.log(
        `...Do the job ${JSON.stringify(event.correlationId)} id=${event.id}`,
      );
    }, 500);
  }
}

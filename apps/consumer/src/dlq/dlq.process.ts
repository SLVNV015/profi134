import { Injectable } from '@nestjs/common';
import { NotifyService } from '../notify/notify.service';
import { EventMessage } from '@app/lib/interfaces/event-message.interface';

@Injectable()
export class DlqProcess {
  constructor(private readonly notifyService: NotifyService) {}

  async processDeadLetter(event: EventMessage) {
    const message = [
      `DeadLetter RabbitMq message recieved:`,
      `id=${event.id}`,
      `type=${event.type}`,
      `correlationId=${event.correlationId}`,
      `timestamp=${new Date(event.timestamp)}`,
      `data=${JSON.stringify(event.payload, null, 2)}`,
    ];
    console.log(message);
    await this.notifyService.notify(message.join('\n'));
  }
}

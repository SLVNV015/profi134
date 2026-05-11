import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { randomUUID } from 'crypto';
import { SendMessageResponseDto } from './dto/send-messge.response.dto';
import { EventMessage } from '@app/lib/interfaces/event-message.interface';
import { OutBoxService } from '../outbox/outbox.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly outboxServie: OutBoxService) {}

  async send(dto: SendMessageDto, correlationId: string) {
    const { type, payload } = dto;
    this.checkBody(payload);

    if (!correlationId) {
      correlationId = randomUUID().toString();
    }

    const eventId = randomUUID().toString();

    try {
      const event: EventMessage = {
        id: eventId,
        type: type,
        correlationId: correlationId,
        timestamp: Date.now(),
        payload,
      };
      await this.outboxServie.saveEvent(event);
      this.logger.log('Message saved');
      return {
        correlationId,
        eventId,
        isChached: false,
      } as SendMessageResponseDto;
    } catch (error) {
      throw error;
    }
  }

  private checkBody(body: Record<string, unknown>) {
    try {
      const payload = JSON.stringify(body);
      if (payload.length > 10000) {
        throw new BadRequestException('Payload is too long');
      }
      if (payload.length < 1) {
        throw new BadRequestException('Payload is empty');
      }
      return;
    } catch (errr) {
      throw errr;
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { randomUUID } from 'crypto';
import { RmqProducer } from '../rmq/rmq.producer';
import { IdepotencyService } from '../idepotency/idepotency.service';
import { SendMessageResponseDto } from './dto/send-messge.response.dto';
import { StorageService } from '../storage/storage.service';
import { EventMessage } from '@app/lib/interfaces/event-message.interface';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly rmqProducer: RmqProducer,
    private readonly idepotencyService: IdepotencyService,
    private readonly storageService: StorageService,
  ) {}

  async send(dto: SendMessageDto, correlationId: string) {
    const { type, payload } = dto;
    this.checkBody(payload);

    if (!correlationId) {
      correlationId = randomUUID().toString();
    }

    const isExisting = await this.idepotencyService.getRecord(correlationId);
    if (isExisting) {
      this.logger.log(`Duplicate request: ${correlationId}`);
      return {
        correlationId,
        eventId: isExisting.eventId!,
        isChached: true,
      } as SendMessageResponseDto;
    }

    const locked = await this.idepotencyService.acquireLock(correlationId);
    if (!locked) {
      throw new ConflictException(
        'Request is processed, please try again later',
      );
    }

    const eventId = randomUUID().toString();
    await this.idepotencyService.saveRecord(correlationId, {
      eventId,
      status: 'pending',
      createdAt: Date.now(),
    });

    try {
      const event: EventMessage = {
        id: eventId,
        type: type,
        correlationId: correlationId,
        timestamp: Date.now(),
        payload,
      };
      await this.rmqProducer.publish('event.process', event);

      await this.idepotencyService.saveRecord(correlationId, {
        eventId,
        status: 'accepted',
        createdAt: Date.now(),
      });
      await this.storageService.incrSucces();
      this.logger.log(`Message sent: ${correlationId}`);
      return {
        correlationId,
        eventId,
        isChached: false,
      } as SendMessageResponseDto;
    } catch (error) {
      await this.idepotencyService.saveRecord(correlationId, {
        eventId,
        status: 'failed',
        createdAt: Date.now(),
      });
      await this.storageService.incrFailure();
      throw error;
    } finally {
      await this.idepotencyService.releaseLock(correlationId);
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

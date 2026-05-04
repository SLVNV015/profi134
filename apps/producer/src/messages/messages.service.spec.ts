import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { RmqProducer } from '../rmq/rmq.producer';
import { IdepotencyService } from '../idepotency/idepotency.service';
import { StorageService } from '../storage/storage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('MessagesService (Producer)', () => {
  let service: MessagesService;
  let rmqProducer: jest.Mocked<RmqProducer>;
  let idepotencyService: jest.Mocked<IdepotencyService>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const mockRmqProducer = {
      publish: jest.fn(),
    };

    const mockIdepotencyService = {
      getRecord: jest.fn(),
      acquireLock: jest.fn(),
      saveRecord: jest.fn(),
      releaseLock: jest.fn(),
    };

    const mockStorageService = {
      incrSucces: jest.fn(),
      incrFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: RmqProducer,
          useValue: mockRmqProducer,
        },
        {
          provide: IdepotencyService,
          useValue: mockIdepotencyService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    rmqProducer = module.get(RmqProducer);
    idepotencyService = module.get(IdepotencyService);
    storageService = module.get(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    const validDto: SendMessageDto = {
      type: 'test-event',
      payload: { key: 'value' },
    };

    it('должен успешно отправить новое сообщение', async () => {
      const correlationId = 'test-corr-id';
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockResolvedValue(undefined);
      storageService.incrSucces.mockResolvedValue(undefined);

      const result = await service.send(validDto, correlationId);

      expect(result).toMatchObject({
        correlationId,
        isChached: false,
      });
      expect(result.eventId).toBeDefined();
      expect(idepotencyService.acquireLock).toHaveBeenCalledWith(correlationId);
      expect(rmqProducer.publish).toHaveBeenCalledWith(
        'event.process',
        expect.objectContaining({
          type: 'test-event',
          correlationId,
          payload: { key: 'value' },
        }),
      );
      expect(storageService.incrSucces).toHaveBeenCalled();
      expect(idepotencyService.releaseLock).toHaveBeenCalledWith(correlationId);
    });

    it('должен сгенерировать correlationId если не передан', async () => {
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockResolvedValue(undefined);
      storageService.incrSucces.mockResolvedValue(undefined);

      const result = await service.send(validDto, '');

      expect(result.correlationId).toBeDefined();
      expect(result.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('должен вернуть кешированный результат для дубликата', async () => {
      const correlationId = 'duplicate-id';
      const existingRecord = {
        eventId: 'existing-event-id',
        status: 'accepted' as const,
        createdAt: Date.now(),
      };
      idepotencyService.getRecord.mockResolvedValue(existingRecord);

      const result = await service.send(validDto, correlationId);

      expect(result).toEqual({
        correlationId,
        eventId: 'existing-event-id',
        isChached: true,
      });
      expect(idepotencyService.acquireLock).not.toHaveBeenCalled();
      expect(rmqProducer.publish).not.toHaveBeenCalled();
    });

    it('должен выбросить ConflictException если не удалось получить блокировку', async () => {
      const correlationId = 'locked-id';
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(false);

      await expect(service.send(validDto, correlationId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.send(validDto, correlationId)).rejects.toThrow(
        'Request is processed, please try again later',
      );
    });

    it('должен сохранить статус failed и увеличить счетчик ошибок при неудаче', async () => {
      const correlationId = 'fail-id';
      const publishError = new Error('RabbitMQ connection failed');
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockRejectedValue(publishError);
      storageService.incrFailure.mockResolvedValue(undefined);

      await expect(service.send(validDto, correlationId)).rejects.toThrow(
        publishError,
      );

      expect(idepotencyService.saveRecord).toHaveBeenCalledWith(
        correlationId,
        expect.objectContaining({
          status: 'failed',
        }),
      );
      expect(storageService.incrFailure).toHaveBeenCalled();
      expect(idepotencyService.releaseLock).toHaveBeenCalledWith(correlationId);
    });

    it('должен освободить блокировку даже при ошибке', async () => {
      const correlationId = 'error-id';
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockRejectedValue(new Error('Test error'));
      storageService.incrFailure.mockResolvedValue(undefined);

      await expect(service.send(validDto, correlationId)).rejects.toThrow();

      expect(idepotencyService.releaseLock).toHaveBeenCalledWith(correlationId);
    });

    it('должен выбросить BadRequestException для слишком большого payload', async () => {
      const largePayload = { data: 'x'.repeat(10001) };
      const dto: SendMessageDto = {
        type: 'test',
        payload: largePayload,
      };

      await expect(service.send(dto, 'test-id')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.send(dto, 'test-id')).rejects.toThrow(
        'Payload is too long',
      );
    });

    it('должен принять пустой объект как валидный payload', async () => {
      const dto: SendMessageDto = {
        type: 'test',
        payload: {},
      };
      const correlationId = 'empty-payload-id';

      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockResolvedValue(undefined);
      storageService.incrSucces.mockResolvedValue(undefined);

      const result = await service.send(dto, correlationId);

      expect(result.correlationId).toBe(correlationId);
      expect(result.isChached).toBe(false);
      expect(rmqProducer.publish).toHaveBeenCalled();
    });

    it('должен сохранить статус pending перед отправкой', async () => {
      const correlationId = 'pending-id';
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockResolvedValue(undefined);
      storageService.incrSucces.mockResolvedValue(undefined);

      await service.send(validDto, correlationId);

      const pendingCall = idepotencyService.saveRecord.mock.calls.find(
        (call) => call[1].status === 'pending',
      );
      expect(pendingCall).toBeDefined();
      expect(pendingCall![1]).toMatchObject({
        status: 'pending',
        eventId: expect.any(String),
        createdAt: expect.any(Number),
      });
    });

    it('должен сохранить статус accepted после успешной отправки', async () => {
      const correlationId = 'accepted-id';
      idepotencyService.getRecord.mockResolvedValue(null);
      idepotencyService.acquireLock.mockResolvedValue(true);
      idepotencyService.saveRecord.mockResolvedValue(undefined);
      idepotencyService.releaseLock.mockResolvedValue(undefined);
      rmqProducer.publish.mockResolvedValue(undefined);
      storageService.incrSucces.mockResolvedValue(undefined);

      await service.send(validDto, correlationId);

      const acceptedCall = idepotencyService.saveRecord.mock.calls.find(
        (call) => call[1].status === 'accepted',
      );
      expect(acceptedCall).toBeDefined();
      expect(acceptedCall![1]).toMatchObject({
        status: 'accepted',
        eventId: expect.any(String),
        createdAt: expect.any(Number),
      });
    });
  });
});

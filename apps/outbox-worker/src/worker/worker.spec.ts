import { Test, TestingModule } from '@nestjs/testing';
import { WorkerService } from './worker';
import { OutboxService } from '../outbox/outbox.service';
import { RmqProducer } from '../rmq/rmq.producer';
import { of, throwError, EMPTY } from 'rxjs';
import { OutboxStatus } from '@app/lib/outbox/outbox.type';

describe('WorkerService', () => {
  let worker: WorkerService;
  let outboxService: jest.Mocked<OutboxService>;
  let rmqProducer: jest.Mocked<RmqProducer>;

  const mockEvent = {
    id: 'test-id-1',
    type: 'test.event',
    status: OutboxStatus.PENDING,
    payload: { data: 'test' },
    timestamp: Date.now(),
    correlationId: 'corr-1',
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockOutboxService = {
      getPendingButch: jest.fn(),
      addAttempt: jest.fn().mockResolvedValue(undefined),
      markOneCompleted: jest.fn(),
      markOneFailed: jest.fn(),
    };

    const mockRmqProducer = {
      rawPublish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: RmqProducer, useValue: mockRmqProducer },
      ],
    }).compile();

    worker = module.get<WorkerService>(WorkerService);
    outboxService = module.get(OutboxService);
    rmqProducer = module.get(RmqProducer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('_processBatch', () => {
    it('должен обработать батч событий успешно', (done) => {
      outboxService.getPendingButch.mockResolvedValue([mockEvent]);
      rmqProducer.rawPublish.mockReturnValue(of(undefined));
      outboxService.markOneCompleted.mockResolvedValue(undefined);

      const subscription = (worker as any)._processBatch().subscribe({
        complete: () => {
          expect(outboxService.getPendingButch).toHaveBeenCalledWith(40);
          expect(rmqProducer.rawPublish).toHaveBeenCalledWith(
            'event.process',
            mockEvent.payload,
          );
          expect(outboxService.markOneCompleted).toHaveBeenCalledWith(
            mockEvent.id,
          );
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('должен вернуть EMPTY если нет событий', (done) => {
      outboxService.getPendingButch.mockResolvedValue([]);

      const subscription = (worker as any)._processBatch().subscribe({
        next: () => {
          fail('Не должно быть значений');
        },
        complete: () => {
          expect(outboxService.getPendingButch).toHaveBeenCalledWith(40);
          expect(rmqProducer.rawPublish).not.toHaveBeenCalled();
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('должен пометить событие как failed при финальной ошибке', (done) => {
      const error = new Error('Network error');
      outboxService.getPendingButch.mockResolvedValue([mockEvent]);
      rmqProducer.rawPublish.mockReturnValue(throwError(() => error));
      outboxService.markOneFailed.mockResolvedValue(undefined);

      const subscription = (worker as any)._processBatch().subscribe({
        complete: () => {
          expect(outboxService.markOneFailed).toHaveBeenCalledWith(
            mockEvent.id,
          );
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('должен обработать несколько событий параллельно', (done) => {
      const events = [
        { ...mockEvent, id: 'id-1' },
        { ...mockEvent, id: 'id-2' },
        { ...mockEvent, id: 'id-3' },
      ];

      outboxService.getPendingButch.mockResolvedValue(events);
      rmqProducer.rawPublish.mockReturnValue(of(undefined));
      outboxService.markOneCompleted.mockResolvedValue(undefined);

      const subscription = (worker as any)._processBatch().subscribe({
        complete: () => {
          expect(rmqProducer.rawPublish).toHaveBeenCalledTimes(3);
          expect(outboxService.markOneCompleted).toHaveBeenCalledTimes(3);
          expect(outboxService.markOneCompleted).toHaveBeenCalledWith('id-1');
          expect(outboxService.markOneCompleted).toHaveBeenCalledWith('id-2');
          expect(outboxService.markOneCompleted).toHaveBeenCalledWith('id-3');
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('должен продолжить обработку если одно событие упало', (done) => {
      const events = [
        { ...mockEvent, id: 'id-1' },
        { ...mockEvent, id: 'id-2' },
      ];

      outboxService.getPendingButch.mockResolvedValue(events);
      rmqProducer.rawPublish
        .mockReturnValueOnce(throwError(() => new Error('Failed')))
        .mockReturnValueOnce(of(undefined));
      outboxService.markOneFailed.mockResolvedValue(undefined);
      outboxService.markOneCompleted.mockResolvedValue(undefined);

      const subscription = (worker as any)._processBatch().subscribe({
        complete: () => {
          expect(outboxService.markOneFailed).toHaveBeenCalledWith('id-1');
          expect(outboxService.markOneCompleted).toHaveBeenCalledWith('id-2');
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('должен обработать ошибку при markOneFailed', (done) => {
      outboxService.getPendingButch.mockResolvedValue([mockEvent]);
      rmqProducer.rawPublish.mockReturnValue(
        throwError(() => new Error('Publish failed')),
      );
      outboxService.markOneFailed.mockRejectedValue(
        new Error('DB error on markFailed'),
      );

      const subscription = (worker as any)._processBatch().subscribe({
        complete: () => {
          expect(outboxService.markOneFailed).toHaveBeenCalledWith(
            mockEvent.id,
          );
          subscription.unsubscribe();
          done();
        },
      });
    });
  });

  describe('lifecycle', () => {
    it('должен корректно остановиться', async () => {
      const stopSpy = jest.spyOn(worker as any, 'stop');

      worker.onModuleDestroy();
      expect(stopSpy).toHaveBeenCalled();

      worker.onApplicationShutdown();
      expect(stopSpy).toHaveBeenCalledTimes(2);
    });
  });
});

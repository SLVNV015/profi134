import { Test, TestingModule } from '@nestjs/testing';
import { IdepotencyService, IdepotencyRecord } from './idepotency.service';
import { REDIS_CLIENT } from '@app/lib/redis/redis.provider';
import { RedisKey } from '@app/lib/constants/redis-key.constants';
import Redis from 'ioredis';

describe('IdepotencyService', () => {
  let service: IdepotencyService;
  let redisClient: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdepotencyService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<IdepotencyService>(IdepotencyService);
    redisClient = module.get(REDIS_CLIENT);
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
  });

  describe('acquireLock', () => {
    it('должен успешно получить блокировку', async () => {
      const correlationId = 'test-correlation-id';
      redisClient.set.mockResolvedValue('OK' as any);

      const result = await service.acquireLock(correlationId);

      expect(result).toBe(true);
      expect(redisClient.set).toHaveBeenCalledWith(
        RedisKey.idempotencyLock(correlationId),
        '1',
        'EX',
        30,
        'NX',
      );
    });

    it('должен вернуть false если блокировка уже существует', async () => {
      const correlationId = 'test-correlation-id';
      redisClient.set.mockResolvedValue(null as any);

      const result = await service.acquireLock(correlationId);

      expect(result).toBe(false);
    });
  });

  describe('getRecord', () => {
    it('должен вернуть запись если она существует', async () => {
      const correlationId = 'test-correlation-id';
      const record: IdepotencyRecord = {
        status: 'accepted',
        eventId: 'event-123',
        createdAt: Date.now(),
      };
      redisClient.get.mockResolvedValue(JSON.stringify(record));

      const result = await service.getRecord(correlationId);

      expect(result).toEqual(record);
      expect(redisClient.get).toHaveBeenCalledWith(
        RedisKey.idempotencyResult(correlationId),
      );
    });

    it('должен вернуть null если запись не существует', async () => {
      const correlationId = 'test-correlation-id';
      redisClient.get.mockResolvedValue(null);

      const result = await service.getRecord(correlationId);

      expect(result).toBeNull();
    });
  });

  describe('saveRecord', () => {
    it('должен сохранить запись в Redis', async () => {
      const correlationId = 'test-correlation-id';
      const record: IdepotencyRecord = {
        status: 'pending',
        eventId: 'event-123',
        createdAt: Date.now(),
      };
      redisClient.set.mockResolvedValue('OK' as any);

      await service.saveRecord(correlationId, record);

      expect(redisClient.set).toHaveBeenCalledWith(
        RedisKey.idempotencyResult(correlationId),
        JSON.stringify(record),
        'EX',
        24 * 60 * 60,
      );
    });
  });

  describe('releaseLock', () => {
    it('должен удалить блокировку', async () => {
      const correlationId = 'test-correlation-id';
      redisClient.del.mockResolvedValue(1);

      await service.releaseLock(correlationId);

      expect(redisClient.del).toHaveBeenCalledWith(
        RedisKey.idempotencyLock(correlationId),
      );
    });
  });
});

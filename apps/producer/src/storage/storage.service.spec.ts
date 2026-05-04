import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { REDIS_CLIENT } from '@app/lib/redis/redis.provider';
import { RedisKey } from '@app/lib/constants/redis-key.constants';
import Redis from 'ioredis';

describe('StorageService', () => {
  let service: StorageService;
  let redisClient: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockRedisClient = {
      incr: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    redisClient = module.get(REDIS_CLIENT);
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
  });

  describe('incrSucces', () => {
    it('должен увеличить счетчик успешных операций', async () => {
      redisClient.incr.mockResolvedValue(1);

      await service.incrSucces();

      expect(redisClient.incr).toHaveBeenCalledWith(RedisKey.statsSuccess());
    });
  });

  describe('incrFailure', () => {
    it('должен увеличить счетчик неудачных операций', async () => {
      redisClient.incr.mockResolvedValue(1);

      await service.incrFailure();

      expect(redisClient.incr).toHaveBeenCalledWith(RedisKey.statsFailure());
    });
  });

  describe('getSuccess', () => {
    it('должен вернуть количество успешных операций', async () => {
      redisClient.get.mockResolvedValue('42');

      const result = await service.getSuccess();

      expect(result).toBe('42');
      expect(redisClient.get).toHaveBeenCalledWith(RedisKey.statsSuccess());
    });

    it('должен вернуть null если счетчик не существует', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await service.getSuccess();

      expect(result).toBeNull();
    });
  });

  describe('getFailure', () => {
    it('должен вернуть количество неудачных операций', async () => {
      redisClient.get.mockResolvedValue('10');

      const result = await service.getFailure();

      expect(result).toBe('10');
      expect(redisClient.get).toHaveBeenCalledWith(RedisKey.statsFailure());
    });

    it('должен вернуть null если счетчик не существует', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await service.getFailure();

      expect(result).toBeNull();
    });
  });
});

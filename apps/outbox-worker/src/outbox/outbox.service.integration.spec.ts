import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { POSTGRES_CONNECTION } from '@app/lib/postgres/postgres.token';
import { createPool, DatabasePool, sql } from 'slonik';
import { OutboxStatus } from '@app/lib/outbox/outbox.type';

describe('OutboxService Integration Tests', () => {
  let service: OutboxService;
  let pool: DatabasePool;

  beforeAll(async () => {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/profi134';

    pool = await createPool(connectionString, {
      maximumPoolSize: 10,
    });

    await pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS outbox (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        timestamp BIGINT NOT NULL,
        correlation_id VARCHAR(255) NOT NULL,
        retry_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'CREATED',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: POSTGRES_CONNECTION,
          useValue: pool,
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  afterAll(async () => {
    await pool.query(sql.unsafe`DROP TABLE IF EXISTS outbox`);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(sql.unsafe`TRUNCATE TABLE outbox`);
  });

  describe('getPendingButch', () => {
    it('должен получить pending события и обновить их статус на PROCESSING', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, status)
        VALUES
          ('id-1', 'test.event', '{"data": "test1"}', ${Date.now()}, 'corr-1', 'CREATED'),
          ('id-2', 'test.event', '{"data": "test2"}', ${Date.now()}, 'corr-2', 'CREATED'),
          ('id-3', 'test.event', '{"data": "test3"}', ${Date.now()}, 'corr-3', 'CREATED')
      `);

      const result = await service.getPendingButch(2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('id-1');
      expect(result[1].id).toBe('id-2');

      const updated = await pool.any(sql.unsafe`
        SELECT id, status FROM outbox WHERE id IN ('id-1', 'id-2')
      `);

      expect(updated.every((row) => row.status === 'PROCESSING')).toBe(true);
    });

    it('должен вернуть пустой массив если нет CREATED событий', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, status)
        VALUES ('id-1', 'test.event', '{"data": "test"}', ${Date.now()}, 'corr-1', 'PROCESSING')
      `);

      const result = await service.getPendingButch(10);

      expect(result).toHaveLength(0);
    });

    it('должен использовать FOR UPDATE SKIP LOCKED для конкурентного доступа', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, status)
        VALUES
          ('id-1', 'test.event', '{"data": "test1"}', ${Date.now()}, 'corr-1', 'CREATED'),
          ('id-2', 'test.event', '{"data": "test2"}', ${Date.now()}, 'corr-2', 'CREATED')
      `);

      const [result1, result2] = await Promise.all([
        service.getPendingButch(1),
        service.getPendingButch(1),
      ]);

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result1[0].id).not.toBe(result2[0].id);
    });
  });

  describe('markOneCompleted', () => {
    it('должен удалить событие из таблицы', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, status)
        VALUES ('id-1', 'test.event', '{"data": "test"}', ${Date.now()}, 'corr-1', 'PROCESSING')
      `);

      await service.markOneCompleted('id-1');

      const result = await pool.maybeOne(sql.unsafe`
        SELECT * FROM outbox WHERE id = 'id-1'
      `);

      expect(result).toBeNull();
    });
  });

  describe('markOneFailed', () => {
    it('должен обновить статус на FAILED', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, status)
        VALUES ('id-1', 'test.event', '{"data": "test"}', ${Date.now()}, 'corr-1', 'PROCESSING')
      `);

      await service.markOneFailed('id-1');

      const result = await pool.one(sql.unsafe`
        SELECT status FROM outbox WHERE id = 'id-1'
      `);

      expect(result.status).toBe('FAILED');
    });
  });

  describe('addAttempt', () => {
    it('должен увеличить retryCount на 1', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, retry_count, status)
        VALUES ('id-1', 'test.event', '{"data": "test"}', ${Date.now()}, 'corr-1', 0, 'PROCESSING')
      `);

      await service.addAttempt('id-1');

      const result = await pool.one(sql.unsafe`
        SELECT retry_count FROM outbox WHERE id = 'id-1'
      `);

      expect(result.retry_count).toBe(1);
    });

    it('должен корректно увеличивать retryCount несколько раз', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO outbox (id, type, payload, timestamp, correlation_id, retry_count, status)
        VALUES ('id-1', 'test.event', '{"data": "test"}', ${Date.now()}, 'corr-1', 0, 'PROCESSING')
      `);

      await service.addAttempt('id-1');
      await service.addAttempt('id-1');
      await service.addAttempt('id-1');

      const result = await pool.one(sql.unsafe`
        SELECT retry_count FROM outbox WHERE id = 'id-1'
      `);

      expect(result.retry_count).toBe(3);
    });
  });
});

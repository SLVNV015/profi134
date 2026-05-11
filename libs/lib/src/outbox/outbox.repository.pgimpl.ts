import { Inject, Injectable } from '@nestjs/common';
import { POSTGRES_CONNECTION } from '../postgres/postgres.token';
import { type DatabasePool, sql } from 'slonik';
import { OutboxRepository, PaginatedResponse } from './outbox.repository';
import { Json, OutboxEntity, outboxSchema } from './outbox.type';

@Injectable()
export class OutboxRepositoryPostgres implements OutboxRepository {
  constructor(
    @Inject(POSTGRES_CONNECTION) private readonly pool: DatabasePool,
  ) {}

  async save(message: OutboxEntity): Promise<void> {
    await this.pool.any(sql.type(outboxSchema)`
      INSERT INTO outbox (
        id,
        type,
        payload,
        timestamp,
        correlationId,
        retryCount,
        status,
        createdAt,
        updatedAt
      )
      VALUES (
        ${message.id},
        ${message.type},
        ${message.payload as any},
        ${message.timestamp},
        ${message.correlationId},
        ${message.retryCount},
        ${message.status},
        ${message.createdAt.toISOString()},
        ${message.updatedAt.toISOString()}
      )
                                     `);
  }
  async markAsProcessed(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async markAsFailed(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async markAsCompleted(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async getPendingMessages(
    count: number,
  ): Promise<PaginatedResponse<OutboxEntity>> {
    throw new Error('Method not implemented.');
  }
  async getFailedMessages(
    count: number,
  ): Promise<PaginatedResponse<OutboxEntity>> {
    throw new Error('Method not implemented.');
  }
  async getProcessingMessages(
    count: number,
  ): Promise<PaginatedResponse<OutboxEntity>> {
    throw new Error('Method not implemented.');
  }
  @Inject(POSTGRES_CONNECTION) private readonly pool: DatabasePool;
}

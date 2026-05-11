import { OutboxEntity } from './outbox.type';

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
};

export interface OutboxRepository {
  save(message: OutboxEntity): Promise<void>;
  markAsProcessed(id: string): Promise<void>;
  markAsFailed(id: string): Promise<void>;
  markAsCompleted(id: string): Promise<void>;
  getPendingMessages(count: number): Promise<PaginatedResponse<OutboxEntity>>;
  getFailedMessages(count: number): Promise<PaginatedResponse<OutboxEntity>>;
  getProcessingMessages(
    count: number,
  ): Promise<PaginatedResponse<OutboxEntity>>;
}

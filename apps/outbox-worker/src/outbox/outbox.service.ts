import { outboxSchema } from '@app/lib/outbox/outbox.type';
import { POSTGRES_CONNECTION } from '@app/lib/postgres/postgres.token';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type DatabasePool } from 'slonik';
import { formatErrorForLog } from '@app/lib/utils/error-classifier';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(POSTGRES_CONNECTION) private readonly pool: DatabasePool,
  ) {}

  async getPendingButch(size: number) {
    try {
      const events = await this.pool.any(sql.type(outboxSchema)`
                           WITH selected_rows AS (
                             SELECT id
                             FROM outbox
                             WHERE status = 'CREATED'
                             ORDER BY timestamp ASC
                             LIMIT ${size}
                             FOR UPDATE SKIP LOCKED
                           )
                           UPDATE outbox
                           SET status = 'PROCESSING'
                           FROM selected_rows
                           WHERE outbox.id = selected_rows.id
                           RETURNING
                             outbox.id,
                             outbox.type,
                             outbox.payload,
                             outbox.timestamp,
                             outbox."correlationId",
                             outbox."retryCount",
                             outbox.status,
                             outbox."createdAt",
                             outbox."updatedAt"
                           `);

      return events;
    } catch (error) {
      this.logger.error(
        `Failed to fetch pending events: ${formatErrorForLog(error)}`,
      );
      throw error;
    }
  }

  async markOneFailed(id: string) {
    try {
      await this.pool.any(sql.type(outboxSchema)`
                           UPDATE outbox
                           SET status = 'FAILED'
                           WHERE id = ${id}
                           `);
      this.logger.debug(`Marked event as FAILED: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to mark event as failed (${id}): ${formatErrorForLog(error)}`,
      );
      throw error;
    }
  }

  async markOneCompleted(id: string) {
    try {
      await this.pool.any(sql.type(outboxSchema)`
                           DELETE FROM outbox
                           WHERE id = ${id}
                           `);
      this.logger.debug(`Deleted completed event: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete completed event (${id}): ${formatErrorForLog(error)}`,
      );
      throw error;
    }
  }

  async addAttempt(id: string) {
    try {
      await this.pool.any(sql.type(outboxSchema)`
                           UPDATE outbox
                           SET retry_count = retry_count + 1
                           WHERE id = ${id}
                           `);
      this.logger.debug(`Incremented retry count for event: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to increment retry count (${id}): ${formatErrorForLog(error)}`,
      );
      throw error;
    }
  }
}

import { EventMessage } from '@app/lib/interfaces/event-message.interface';
import { outboxSchema } from '@app/lib/outbox/outbox.type';
import { POSTGRES_CONNECTION } from '@app/lib/postgres/postgres.token';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type DatabasePool } from 'slonik';
import { formatErrorForLog } from '@app/lib/utils/error-classifier';

@Injectable()
export class OutBoxService {
  private readonly logger = new Logger(OutBoxService.name);

  constructor(
    @Inject(POSTGRES_CONNECTION) private readonly pool: DatabasePool,
  ) {}

  async saveEvent(event: EventMessage) {
    try {
      const nowDate = new Date().toISOString();

      this.logger.debug(
        `Saving event to outbox: id=${event.id}, type=${event.type}`,
      );

      await this.pool.any(sql.type(outboxSchema)`
                          INSERT INTO outbox (
                            id,
                            type,
                            payload,
                            timestamp,
                            "correlationId",
                            "retryCount",
                            status,
                            "createdAt",
                            "updatedAt"
                          )
                          VALUES (
                            ${event.id},
                            ${event.type},
                            ${sql.json(event.payload as any)},
                            ${event.timestamp},
                            ${event.correlationId},
                            0,
                            'CREATED',
                            ${nowDate},
                            ${nowDate}
                          )
                          `);

      this.logger.log(`Event saved to outbox: ${event.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to save event to outbox: ${formatErrorForLog(error)}`,
      );
      this.logger.error(`Event data: ${JSON.stringify(event, null, 2)}`);
      throw error;
    }
  }
}

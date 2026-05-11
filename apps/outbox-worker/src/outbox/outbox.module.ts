import { PostgresModule } from '@app/lib/postgres/postgres.module';
import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';

@Module({
  imports: [PostgresModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}

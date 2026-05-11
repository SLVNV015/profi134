import { PostgresModule } from '@app/lib/postgres/postgres.module';
import { Module } from '@nestjs/common';
import { OutBoxService } from './outbox.service';

@Module({
  imports: [PostgresModule],
  providers: [OutBoxService],
  exports: [OutBoxService],
})
export class OutBoxModule {}

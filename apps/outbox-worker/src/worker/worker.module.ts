import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { RmqModule } from '../rmq/rmq.module';
import { ConfigModule } from '@nestjs/config';
import { WorkerService } from './worker';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OutboxModule, RmqModule],
  providers: [WorkerService],
})
export class WorkerModule {}

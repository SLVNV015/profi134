import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotifyModule } from '../notify/notify.module';
import { DlqController } from './dlq.contoller';
import { DlqProcess } from './dlq.process';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NotifyModule],
  controllers: [DlqController],
  providers: [DlqProcess],
})
export class DlqModule {}

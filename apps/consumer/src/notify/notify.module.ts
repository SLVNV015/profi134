import { TelegramClientModule } from '@app/lib/telegram/telegram-client.module';
import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service';

@Module({
  imports: [TelegramClientModule],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}

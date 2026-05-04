import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramClient } from './telegram-client';

@Module({
  providers: [TelegramClient],
  exports: [TelegramClient],
  imports: [ConfigModule],
})
export class TelegramClientModule {}

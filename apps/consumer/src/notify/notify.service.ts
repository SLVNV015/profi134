import { TelegramClient } from '@app/lib/telegram/telegram-client';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotifyService {
  private readonly _chatId: string;
  constructor(
    private readonly tgClient: TelegramClient,
    private readonly cfg: ConfigService,
  ) {
    this._chatId = this.cfg.getOrThrow<string>('TELEGRAM_CHAT_ID');
  }

  async notify(message: string) {
    return await this.tgClient.sendMessage(this._chatId, message);
  }
}

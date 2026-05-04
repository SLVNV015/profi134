import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';

@Injectable()
export class TelegramClient {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(TelegramClient.name);

  constructor(private readonly cfg: ConfigService) {
    const token = cfg.getOrThrow<string>('TELEGRAM_BOT_TOKEN');

    this.http = require('axios').create({
      baseURL: `https://api.telegram.org/bot${token}/`,
      timeout: 5000,
    });
  }

  async sendMessage(chatId: string, text: string) {
    try {
      await this.http.post('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
    } catch (e) {
      this.logger.error(e);
    }
  }
}

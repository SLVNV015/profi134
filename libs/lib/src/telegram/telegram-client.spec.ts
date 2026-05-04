import { Test, TestingModule } from '@nestjs/testing';
import { TelegramClient } from './telegram-client';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

jest.mock('axios');

describe('TelegramClient', () => {
  let client: TelegramClient;
  let configService: jest.Mocked<ConfigService>;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-bot-token'),
    };

    const axios = require('axios');
    axios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramClient,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    client = module.get<TelegramClient>(TelegramClient);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен быть определен', () => {
    expect(client).toBeDefined();
  });

  it('должен создать axios instance с правильным baseURL', () => {
    const axios = require('axios');
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.telegram.org/bottest-bot-token/',
      timeout: 5000,
    });
  });

  it('должен загрузить токен из конфигурации', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('TELEGRAM_BOT_TOKEN');
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение через Telegram API', async () => {
      const chatId = '123456789';
      const text = 'Test message';
      mockAxiosInstance.post.mockResolvedValue({ data: { ok: true } });

      await client.sendMessage(chatId, text);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
    });

    it('должен логировать ошибку при неудачной отправке', async () => {
      const chatId = '123456789';
      const text = 'Test message';
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await client.sendMessage(chatId, text);

      expect(loggerErrorSpy).toHaveBeenCalledWith(error);
      loggerErrorSpy.mockRestore();
    });

    it('не должен выбрасывать ошибку при неудачной отправке', async () => {
      const chatId = '123456789';
      const text = 'Test message';
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await expect(client.sendMessage(chatId, text)).resolves.not.toThrow();
    });
  });
});

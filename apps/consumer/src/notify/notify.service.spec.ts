import { Test, TestingModule } from '@nestjs/testing';
import { NotifyService } from './notify.service';
import { TelegramClient } from '@app/lib/telegram/telegram-client';
import { ConfigService } from '@nestjs/config';

describe('NotifyService', () => {
  let service: NotifyService;
  let tgClient: jest.Mocked<TelegramClient>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockTgClient = {
      sendMessage: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-chat-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyService,
        {
          provide: TelegramClient,
          useValue: mockTgClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
    tgClient = module.get(TelegramClient);
    configService = module.get(ConfigService);
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
  });

  it('должен загрузить chatId из конфигурации при инициализации', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('TELEGRAM_CHAT_ID');
  });

  describe('notify', () => {
    it('должен отправить сообщение через TelegramClient', async () => {
      const message = 'Test notification message';
      tgClient.sendMessage.mockResolvedValue(undefined);

      await service.notify(message);

      expect(tgClient.sendMessage).toHaveBeenCalledWith('test-chat-id', message);
    });

    it('должен вернуть результат от TelegramClient', async () => {
      const message = 'Test message';
      const expectedResult = { success: true };
      tgClient.sendMessage.mockResolvedValue(expectedResult as any);

      const result = await service.notify(message);

      expect(result).toEqual(expectedResult);
    });
  });
});

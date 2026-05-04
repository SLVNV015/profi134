import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { NotifyService } from '../notify/notify.service';
import { EventMessage } from '@app/lib/interfaces/event-message.interface';
import { Logger } from '@nestjs/common';

describe('MessagesService (Consumer)', () => {
  let service: MessagesService;
  let notifyService: jest.Mocked<NotifyService>;

  beforeEach(async () => {
    const mockNotifyService = {
      notify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: NotifyService,
          useValue: mockNotifyService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    notifyService = module.get(NotifyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
  });

  describe('process', () => {
    it('должен обработать событие и отправить уведомление', async () => {
      const event: EventMessage = {
        id: 'event-123',
        type: 'test-event',
        correlationId: 'corr-456',
        timestamp: 1714838400000,
        payload: { key: 'value', nested: { data: 'test' } },
      };

      notifyService.notify.mockResolvedValue(undefined);

      await service.process(event);

      expect(notifyService.notify).toHaveBeenCalledTimes(1);
      const notifyCall = notifyService.notify.mock.calls[0][0];

      expect(notifyCall).toContain('Succes RabbitMq message recieved:');
      expect(notifyCall).toContain('id=event-123');
      expect(notifyCall).toContain('type=test-event');
      expect(notifyCall).toContain('correlationId=corr-456');
      expect(notifyCall).toContain('"key": "value"');
    });

    it('должен форматировать payload как JSON', async () => {
      const event: EventMessage = {
        id: 'event-789',
        type: 'complex-event',
        correlationId: 'corr-999',
        timestamp: Date.now(),
        payload: {
          user: 'john',
          action: 'login',
          metadata: { ip: '127.0.0.1' },
        },
      };

      notifyService.notify.mockResolvedValue(undefined);

      await service.process(event);

      const notifyCall = notifyService.notify.mock.calls[0][0];
      expect(notifyCall).toContain('"user": "john"');
      expect(notifyCall).toContain('"action": "login"');
      expect(notifyCall).toContain('"ip": "127.0.0.1"');
    });

    it('должен логировать выполнение работы', async () => {
      const event: EventMessage = {
        id: 'event-log',
        type: 'log-test',
        correlationId: 'corr-log',
        timestamp: Date.now(),
        payload: {},
      };

      const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      notifyService.notify.mockResolvedValue(undefined);

      await service.process(event);

      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('...Do the job'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('corr-log'),
      );

      loggerSpy.mockRestore();
    });
  });
});

import { RmqOptParam, rmqSetup } from '@app/lib/utils/rmq.setup';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { RpcExceptionFilter } from '@app/lib/filter/rpc-exception.filter';
import { DlqModule } from './dlq/dlq.module';

async function bootstrap() {
  const logger = new Logger('CONSUMER app');

  const rmqUrl = process.env.RABBITMQ_URL;
  if (!rmqUrl) {
    logger.error('RABBITMQ_URL is not set');
    process.exit(1);
  }

  try {
    await rmqSetup(rmqUrl);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        noAck: false,
        ...RmqOptParam,
      },
    },
  );

  const dlqListenApp =
    await NestFactory.createMicroservice<MicroserviceOptions>(DlqModule, {
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        noAck: false,
        queue: 'main.queue.dead',
        persistent: true,
        queueOptions: {
          durable: true,
        },
      },
    });

  app.useGlobalFilters(new RpcExceptionFilter());
  dlqListenApp.useGlobalFilters(new RpcExceptionFilter());

  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(
      'Unhandled Rejection at:',
      reason instanceof Error ? reason.stack : reason,
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown', error);
    process.exit(1);
  });

  await app.listen();
  await dlqListenApp.listen();
  logger.log(
    `Application starts listen RPC context (main.queue + dead.letter.queue)`,
  );
}
bootstrap();

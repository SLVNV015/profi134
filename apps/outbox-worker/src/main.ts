import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);

  process.on('SIGINT', async () => {
    await app.close();

    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.close();

    process.exit(0);
  });

  process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error(err);
    process.exit(1);
  });
}
bootstrap();

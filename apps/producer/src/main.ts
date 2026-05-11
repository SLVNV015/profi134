import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@app/lib/filter/http-exception.filter';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(new ValidationPipe());
  const logger = new Logger('PRODUCER app');

  const config = new DocumentBuilder()
    .setTitle('Profi134')
    .setDescription('The Profi134 API description')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

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
  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application started on port ${process.env.port}`);
}
bootstrap();

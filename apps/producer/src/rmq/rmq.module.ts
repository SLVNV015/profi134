import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RmqProducer } from './rmq.producer';
import { RABBITMQ_CLIENT } from './rmq.token';
import { RmqOptParam } from '@app/lib/utils/rmq.setup';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [cfg.getOrThrow<string>('RABBITMQ_URL')],
            ...RmqOptParam,
          },
        }),
      },
    ]),
  ],
  providers: [RmqProducer],
  exports: [RmqProducer, ClientsModule],
})
export class RmqModule {}

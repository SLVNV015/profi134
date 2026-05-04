import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { firstValueFrom, retry, timer } from 'rxjs';
import { isNetworkError } from '@app/lib/utils/is-network-error';
import { RABBITMQ_CLIENT } from './rmq.token';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RmqProducer implements OnModuleInit {
  private readonly logger = new Logger(RmqProducer.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly _client: ClientProxy) {}

  async onModuleInit() {
    await this._client.connect();
  }

  async publish<T>(pattern: string, data: T) {
    await firstValueFrom(
      this._client
        .emit(pattern, {
          data,
        })
        .pipe(
          retry({
            count: 3,
            delay: (err, attmpt) => {
              if (!isNetworkError(err)) {
                throw err;
              }

              const delay = Math.pow(2, attmpt) * 1000;
              this.logger.warn(
                `Network error, retrying in ${delay}ms: ${err.message}`,
              );
              return timer(delay);
            },
          }),
        ),
    );
  }
}

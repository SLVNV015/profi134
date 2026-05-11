import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RmqProducer } from '../rmq/rmq.producer';
import { OutboxService } from '../outbox/outbox.service';
import {
  catchError,
  EMPTY,
  from,
  ignoreElements,
  interval,
  mergeMap,
  Observable,
  retry,
  Subject,
  Subscription,
  takeUntil,
  tap,
  timeout,
  timer,
} from 'rxjs';
import {
  isRetryableError,
  formatErrorForLog,
  classifyError,
  ErrorType,
} from '@app/lib/utils/error-classifier';

@Injectable()
export class WorkerService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private _isRunning = true;
  private shutDown$ = new Subject<void>();
  private subscriptions: Subscription | null = null;

  private readonly logger = new Logger(WorkerService.name);
  constructor(
    private readonly outboxService: OutboxService,
    private readonly rmqProducer: RmqProducer,
  ) {}

  onModuleDestroy() {
    this.stop();
  }

  onApplicationShutdown(_signal?: string) {
    this.stop();
  }

  async onModuleInit() {
    await this.start();
  }

  async start() {
    interval(600)
      .pipe(
        mergeMap(() => this._processBatch()),
        takeUntil(this.shutDown$),
      )
      .subscribe({
        error: (err) => {
          this.logger.error('Worker error', err);
        },
      });
  }

  async stop() {
    this.logger.log('Shutting down...');

    this._isRunning = false;
    this.shutDown$.next();
    this.shutDown$.complete();

    await Promise.race([
      this._waitForComplete(),
      new Promise((resolve) => setTimeout(resolve, 15_000)),
    ]).catch((err) => this.logger.error(err));

    this.logger.log('Shut down worker process');
  }

  private _processBatch(): Observable<void> {
    return from(this.outboxService.getPendingButch(40)).pipe(
      mergeMap((events) =>
        events.length === 0
          ? EMPTY
          : from(events).pipe(
              mergeMap((event) => {
                const serializedEvent = {
                  ...event,
                  timestamp:
                    typeof event.timestamp === 'bigint'
                      ? Number(event.timestamp)
                      : event.timestamp,
                };

                return this.rmqProducer
                  .rawPublish('event.process', { data: serializedEvent })
                  .pipe(
                    timeout(20_000),
                    retry({
                      count: 3,
                      delay: (err, attmpt) => {
                        const errorContext = classifyError(err);

                        this.logger.warn(
                          `Error publishing event ${event.id}: ${formatErrorForLog(err)}`,
                        );

                        if (errorContext.type === ErrorType.VALIDATION) {
                          this.logger.error(
                            `Validation error for event ${event.id}, skipping retry`,
                          );
                          throw err;
                        }

                        if (!isRetryableError(err)) {
                          this.logger.error(
                            `Non-retryable error for event ${event.id}, skipping retry`,
                          );
                          throw err;
                        }

                        const expDelay = Math.pow(2, attmpt) * 1000;
                        const delay = Math.random() * expDelay;

                        this.logger.warn(
                          `Retrying event ${event.id} in ${Math.round(delay)}ms (attempt ${attmpt + 2}/3)`,
                        );

                        from(this.outboxService.addAttempt(event.id))
                          .pipe(catchError(() => EMPTY))
                          .subscribe();

                        return timer(delay);
                      },
                    }),
                    mergeMap(() =>
                      from(this.outboxService.markOneCompleted(event.id)),
                    ),
                    catchError((err) => {
                      this.logger.error(
                        `Failed to process event ${event.id} after retries: ${formatErrorForLog(err)}`,
                      );
                      return from(
                        this.outboxService.markOneFailed(event.id),
                      ).pipe(
                        catchError((dbErr) => {
                          this.logger.error(
                            `Failed to mark event ${event.id} as failed: ${formatErrorForLog(dbErr)}`,
                          );
                          return EMPTY;
                        }),
                      );
                    }),
                  );
              }),
            ),
      ),
      ignoreElements(),
    );
  }

  private _waitForComplete(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.subscriptions || this.subscriptions.closed) {
        resolve();
        return;
      }

      this.subscriptions.add(() => resolve);
    });
  }
}

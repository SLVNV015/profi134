import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError, Observable } from 'rxjs';
import { normalizeError, logException } from './base-exception.filter';

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: unknown, _: ArgumentsHost): Observable<never> {
    const normalized = normalizeError(exception);

    logException(this.logger, normalized, 'RPC');

    const rpcError =
      exception instanceof RpcException
        ? exception
        : new RpcException({
            message: normalized.message,
            code: normalized.code ?? 'INTERNAL_ERROR',
          });

    return throwError(() => rpcError);
  }
}

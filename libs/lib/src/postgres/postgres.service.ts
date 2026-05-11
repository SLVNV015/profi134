import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { createPool, DatabasePool } from 'slonik';

@Injectable()
export class PostgresService implements OnModuleDestroy, OnApplicationShutdown {
  private pool: DatabasePool;

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }
  async onApplicationShutdown(_signal?: string) {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async createPool(dbUrl: string) {
    this.pool = await createPool(dbUrl);
    return this.pool;
  }
}

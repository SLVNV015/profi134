import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostgresService } from './postgres.service';
import { POSTGRES_CONNECTION } from './postgres.token';

@Module({
  imports: [ConfigModule],
  providers: [
    PostgresService,
    {
      provide: POSTGRES_CONNECTION,
      useFactory: async (
        cfg: ConfigService,
        postgresService: PostgresService,
      ) => {
        const pgUrls = cfg.getOrThrow<string>('POSTGRES_URL');
        return await postgresService.createPool(pgUrls);
      },
      inject: [ConfigService, PostgresService],
    },
  ],
  exports: [POSTGRES_CONNECTION],
})
export class PostgresModule {}

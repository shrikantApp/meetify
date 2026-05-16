import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null, enableOfflineQueue: false });
        client.on('error', (err) => {
          if (!(client as any).hasLoggedError) {
            console.warn('[Redis] connection failed. Presence features will be limited:', err.message || 'Connection refused');
            (client as any).hasLoggedError = true;
          }
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

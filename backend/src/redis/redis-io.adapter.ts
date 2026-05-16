import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
    const configService = app.get(ConfigService);
    const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    // Set maxRetriesPerRequest to null so it doesn't throw MaxRetriesPerRequestError and crash
    const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    const subClient = pubClient.duplicate();

    // Prevent unhandled error events from crashing the Node process
    pubClient.on('error', (err) => console.warn('[Redis] PubClient Error:', err.message));
    subClient.on('error', (err) => console.warn('[Redis] SubClient Error:', err.message));

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

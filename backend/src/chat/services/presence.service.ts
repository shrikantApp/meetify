import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

const ONLINE_KEY = (userId: string) => `presence:online:${userId}`;
const LAST_SEEN_KEY = (userId: string) => `presence:lastseen:${userId}`;
const SOCKET_MAP_KEY = (userId: string) => `presence:sockets:${userId}`;

@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

  /** Mark user as online, store their socketId */
  async setOnline(userId: string, socketId: string): Promise<void> {
    try {
      await this.redis.set(ONLINE_KEY(userId), '1', 'EX', 300); // 5-min TTL, refreshed on heartbeat
      await this.redis.sadd(SOCKET_MAP_KEY(userId), socketId);
      await this.redis.expire(SOCKET_MAP_KEY(userId), 300);
    } catch (e) {
      // Ignore if Redis is offline
    }
  }

  /** Remove socketId; mark offline only if no more sockets */
  async setOffline(userId: string, socketId: string): Promise<void> {
    try {
      await this.redis.srem(SOCKET_MAP_KEY(userId), socketId);
      const remaining = await this.redis.scard(SOCKET_MAP_KEY(userId));
      if (remaining === 0) {
        await this.redis.del(ONLINE_KEY(userId));
        await this.redis.set(LAST_SEEN_KEY(userId), Date.now().toString());
      }
    } catch (e) {
      // Ignore if Redis is offline
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    try {
      const val = await this.redis.get(ONLINE_KEY(userId));
      return val === '1';
    } catch (e) {
      return false; // Assume offline if Redis is down
    }
  }

  async getSocketIds(userId: string): Promise<string[]> {
    try {
      return await this.redis.smembers(SOCKET_MAP_KEY(userId));
    } catch (e) {
      return [];
    }
  }

  async getLastSeen(userId: string): Promise<Date | null> {
    try {
      const ts = await this.redis.get(LAST_SEEN_KEY(userId));
      return ts ? new Date(parseInt(ts)) : null;
    } catch (e) {
      return null;
    }
  }

  /** Returns map of userId → { online, lastSeen } for a list of users */
  async getBulkPresence(userIds: string[]): Promise<Record<string, { online: boolean; lastSeen: Date | null }>> {
    if (!userIds.length) return {};
    const map: Record<string, { online: boolean; lastSeen: Date | null }> = {};

    try {
      const pipeline = this.redis.pipeline();
      for (const id of userIds) {
        pipeline.get(ONLINE_KEY(id));
        pipeline.get(LAST_SEEN_KEY(id));
      }
      const results = await pipeline.exec();

      for (let i = 0; i < userIds.length; i++) {
        const onlineVal = results?.[i * 2]?.[1] as string | null;
        const lastSeenVal = results?.[i * 2 + 1]?.[1] as string | null;
        map[userIds[i]] = {
          online: onlineVal === '1',
          lastSeen: lastSeenVal ? new Date(parseInt(lastSeenVal)) : null,
        };
      }
    } catch (e) {
      // Default to offline if Redis is down
      for (const id of userIds) {
        map[id] = { online: false, lastSeen: null };
      }
    }
    return map;
  }

  /** Heartbeat — refreshes TTL to keep user marked online */
  async heartbeat(userId: string, socketId: string): Promise<void> {
    await this.setOnline(userId, socketId);
  }
}

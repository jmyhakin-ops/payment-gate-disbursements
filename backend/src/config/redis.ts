import Redis from 'ioredis';
import { env } from './env';

let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => console.log('✅ Redis connected'));
    redisClient.on('error', (err) => console.error('❌ Redis error:', err));
    redisClient.on('close', () => console.warn('⚠️  Redis connection closed'));
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  try {
    await client.connect();
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    process.exit(1);
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    console.log('🔌 Redis disconnected');
  }
}

// Helpers
export async function cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  await getRedisClient().setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await getRedisClient().get(key);
  return data ? (JSON.parse(data) as T) : null;
}

export async function cacheDel(key: string): Promise<void> {
  await getRedisClient().del(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const keys = await getRedisClient().keys(pattern);
  if (keys.length > 0) {
    await getRedisClient().del(...keys);
  }
}

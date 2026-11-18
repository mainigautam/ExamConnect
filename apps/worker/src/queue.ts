import { Queue } from "bullmq";
import { Redis, type RedisOptions } from "ioredis";

function buildRedisConnection(): Redis {
  const commonOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },
  };

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    const usesTls = redisUrl.startsWith("rediss://");
    return new Redis(redisUrl, {
      ...commonOptions,
      ...(usesTls ? { tls: {} } : {}),
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    ...commonOptions,
  });
}

export const redisConnection = buildRedisConnection();

export const notificationQueue = new Queue("examconnect-notifications", {
  connection: redisConnection,
});

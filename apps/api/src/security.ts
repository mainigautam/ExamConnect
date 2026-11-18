import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (request: FastifyRequest) => string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

// Periodically purge expired buckets to prevent unbounded memory growth
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
cleanupInterval.unref?.();

export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function createRateLimiter(options: RateLimitOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const clientKey = options.keyGenerator
      ? options.keyGenerator(request)
      : request.ip || "unknown";
    const key = `${options.keyPrefix}:${clientKey}`;

    const result = checkRateLimit(key, options.windowMs, options.maxRequests);

    reply.header("X-RateLimit-Limit", String(options.maxRequests));
    reply.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      reply.header("Retry-After", String(result.retryAfterSeconds));
      return reply.code(429).send({
        error: "RATE_LIMITED",
        message: "Too many requests. Please wait a few minutes before trying again.",
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  };
}

export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("X-XSS-Protection", "0");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    return payload;
  });
}

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const secureCookie =
    process.env.COOKIE_SECURE === "true" ||
    (isProd && process.env.COOKIE_SECURE !== "false");

  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite: (isProd && secureCookie ? "none" : "lax") as "lax" | "none" | "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }
  if (password.length > 128) {
    errors.push("Password must be 128 characters or fewer.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

import { AppError } from './errors.js';

/** Fixed-window counter. Pure and clock-injectable so it can be unit tested. */
export function createLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map();
  return {
    hit(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.reset <= t) {
        entry = { count: 0, reset: t + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= max,
        remaining: Math.max(0, max - entry.count),
        retryAfterMs: Math.max(0, entry.reset - t),
      };
    },
    sweep() {
      const t = now();
      for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
    },
  };
}

/**
 * Express middleware. In-memory, so it is per-process: fine for a single-instance MVP,
 * swap for a Redis-backed store when scaling horizontally (documented in ARCHITECTURE.md).
 */
export function rateLimit({ windowMs, max, keyFn = (req) => req.ip }) {
  const limiter = createLimiter({ windowMs, max });
  setInterval(() => limiter.sweep(), windowMs).unref();
  return (req, res, next) => {
    const result = limiter.hit(keyFn(req));
    if (!result.allowed) {
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return next(new AppError(429, 'rate_limited', 'Too many requests. Please slow down.'));
    }
    next();
  };
}

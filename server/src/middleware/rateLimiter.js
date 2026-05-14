const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000, // Increase to 10s to prevent handshake timeouts
  }
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  console.error('[RateLimiter] Redis Client Error:', err);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  console.log('[RateLimiter] Successfully connected to Redis');
  isRedisConnected = true;
});

redisClient.on('reconnecting', () => {
  console.log('[RateLimiter] Reconnecting to Redis...');
});

// Connect to Redis (non-blocking, don't await at module level to prevent crashing if down)
redisClient.connect().catch((err) => {
  console.error('[RateLimiter] Initial Redis connection failed:', err);
  // Fail-open strategy handles this natively below
});

// Create the rate limiter
const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Best Practice: High limit (500) to stop DDoS, but allow normal React App usage
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom response when rate limit is exceeded
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: "Too Many Requests",
      message: "You are currently in a 5-minute timeout. Stop spamming.",
      retry_after: "5 minutes"
    });
  },

  // Skip logic: VIP Bypass for cron jobs
  skip: (req, res) => {
    const headerName = (process.env.CRON_HEADER).toLowerCase();
    const cronHeader = req.headers[headerName];
    if (cronHeader && cronHeader === process.env.CRON_SECRET) {
      console.log(`[RateLimiter] Skipping rate limit for internal cron job.`);
      return true;
    }
    return false;
  },

  // Configure Redis Store with Fail-Open strategy
  store: {
    // We implement a custom wrapper around RedisStore to gracefully handle failures
    // Note: express-rate-limit will fallback to memory store if store is omitted, 
    // but rate-limit-redis provides an underlying store mechanism.
    // If Redis is down, we want to fail-open (allow traffic).
    init: function (options) {
      this.redisStore = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
      // RateLimit store init
      if (typeof this.redisStore.init === 'function') {
        this.redisStore.init(options);
      }
    },
    increment: async function (key) {
      if (!isRedisConnected) {
        // Fail-Open: If Redis is down, don't track, just allow.
        return { totalHits: 1, resetTime: new Date(Date.now() + 5 * 60 * 1000) };
      }
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        console.error('[RateLimiter] Redis increment failed, failing open:', err);
        return { totalHits: 1, resetTime: new Date(Date.now() + 5 * 60 * 1000) };
      }
    },
    decrement: async function (key) {
      if (!isRedisConnected) return;
      try {
        await this.redisStore.decrement(key);
      } catch (err) {
        console.error('[RateLimiter] Redis decrement failed:', err);
      }
    },
    resetKey: async function (key) {
      if (!isRedisConnected) return;
      try {
        await this.redisStore.resetKey(key);
      } catch (err) {
        console.error('[RateLimiter] Redis resetKey failed:', err);
      }
    }
  }
});

module.exports = rateLimiter;

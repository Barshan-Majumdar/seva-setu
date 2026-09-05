const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  }
});

let errorCount = 0;
redis.on('error', (err) => {
  if (errorCount++ < 1) console.error('[RedisService] Connection Error:', err.message);
});

/**
 * Get bot session from Redis
 */
const getBotSession = async (phoneNumber) => {
  if (redis.status !== 'ready') return null;
  const data = await redis.get(`bot_session:${phoneNumber}`);
  return data ? JSON.parse(data) : null;
};

/**
 * Save bot session to Redis with 1-hour expiration
 */
const saveBotSession = async (phoneNumber, sessionData) => {
  if (redis.status !== 'ready') return;
  await redis.set(
    `bot_session:${phoneNumber}`, 
    JSON.stringify(sessionData), 
    'EX', 
    3600 
  );
};

const deleteBotSession = async (phoneNumber) => {
  if (redis.status !== 'ready') return;
  await redis.del(`bot_session:${phoneNumber}`);
};

/**
 * Global Cache Methods
 */
const getCache = async (key) => {
  if (redis.status !== 'ready') return null;
  const data = await redis.get(`cache:${key}`);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, ttlSeconds = 30) => {
  if (redis.status !== 'ready') return;
  await redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
};

const clearCache = async (pattern) => {
  if (redis.status !== 'ready') return;
  const keys = await redis.keys(`cache:${pattern}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

const deleteCache = async (key) => {
  if (redis.status !== 'ready') return;
  await redis.del(`cache:${key}`);
};

/**
 * Set Operations (for background jobs)
 */
const addToSet = async (key, value) => {
  if (redis.status !== 'ready') return;
  await redis.sadd(key, value);
};

const removeFromSet = async (key, value) => {
  if (redis.status !== 'ready') return;
  await redis.srem(key, value);
};

const getSet = async (key) => {
  if (redis.status !== 'ready') return [];
  return await redis.smembers(key);
};

module.exports = {
  getBotSession,
  saveBotSession,
  deleteBotSession,
  getCache,
  setCache,
  clearCache,
  deleteCache,
  addToSet,
  removeFromSet,
  getSet,
  redis // Export raw client for special cases
};

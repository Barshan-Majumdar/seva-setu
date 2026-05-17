const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => {
  console.error('[RedisService] Connection Error:', err.message);
});

/**
 * Get bot session from Redis
 */
const getBotSession = async (phoneNumber) => {
  const data = await redis.get(`bot_session:${phoneNumber}`);
  return data ? JSON.parse(data) : null;
};

/**
 * Save bot session to Redis with 1-hour expiration
 */
const saveBotSession = async (phoneNumber, sessionData) => {
  await redis.set(
    `bot_session:${phoneNumber}`, 
    JSON.stringify(sessionData), 
    'EX', 
    3600 
  );
};

const deleteBotSession = async (phoneNumber) => {
  await redis.del(`bot_session:${phoneNumber}`);
};

/**
 * Global Cache Methods
 */
const getCache = async (key) => {
  const data = await redis.get(`cache:${key}`);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, ttlSeconds = 30) => {
  await redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
};

const clearCache = async (pattern) => {
  const keys = await redis.keys(`cache:${pattern}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

/**
 * Set Operations (for background jobs)
 */
const addToSet = async (key, value) => {
  await redis.sadd(key, value);
};

const removeFromSet = async (key, value) => {
  await redis.srem(key, value);
};

const getSet = async (key) => {
  return await redis.smembers(key);
};

module.exports = {
  getBotSession,
  saveBotSession,
  deleteBotSession,
  getCache,
  setCache,
  clearCache,
  addToSet,
  removeFromSet,
  getSet,
  redis // Export raw client for special cases
};

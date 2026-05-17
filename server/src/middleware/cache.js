const redisService = require('../services/redisService');

/**
 * Middleware to cache GET requests in Redis.
 * @param {number} ttl - Time to live in seconds.
 */
const cacheMiddleware = (ttl = 30) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate a unique cache key based on path, user ID (if auth), and query params
    const queryStr = JSON.stringify(req.query);
    const userId = req.user?.id || 'public';
    const key = `${req.baseUrl}${req.path}:${userId}:${queryStr}`;

    try {
      const cachedData = await redisService.getCache(key);
      
      if (cachedData) {
        console.log(`[CACHE HIT] Serving ${req.url} from Redis (0 DB Queries)`);
        return res.json(cachedData);
      }

      // If not in cache, override res.json to capture the data
      const originalJson = res.json;
      res.json = (body) => {
        res.json = originalJson; // Restore original json
        
        // Only cache successful responses
        if (res.statusCode === 200) {
          redisService.setCache(key, body, ttl).catch(err => 
            console.error('[CACHE] Set error:', err.message)
          );
        }
        
        return res.json(body);
      };

      next();
    } catch (err) {
      console.error('[CACHE] Middleware error:', err.message);
      next(); // Fail-open: continue to DB if Redis fails
    }
  };
};

module.exports = cacheMiddleware;

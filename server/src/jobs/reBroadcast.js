const prisma = require('../config/db');
const { triggerBroadcast } = require('../services/matchingService');
const redisService = require('../services/redisService');

/**
 * Periodically sweep for open needs that require re-broadcasting.
 * Uses Redis to check for work BEFORE hitting the database to save credits.
 */
const startReBroadcastJob = () => {
  setInterval(async () => {
    try {
      // 1. Check Redis first (Zero DB cost)
      const needsToProcess = await redisService.getSet('needs_to_rebroadcast');
      
      if (!needsToProcess || needsToProcess.length === 0) {
        // No active needs to broadcast — let the DB sleep!
        return;
      }

      console.log(`[CRON] Found ${needsToProcess.length} candidate(s) in Redis. Waking DB...`);

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      // 2. Only now do we hit the DB to verify they are still 'open' and fresh
      const pendingNeeds = await prisma.need.findMany({
        where: {
          id: { in: needsToProcess },
          status: 'open',
          createdAt: { gte: thirtyMinutesAgo }
        },
        select: { id: true, title: true, createdAt: true }
      });

      if (pendingNeeds.length > 0) {
        for (const need of pendingNeeds) {
          try {
            await triggerBroadcast(need.id, 2);
            console.log(`[CRON] Re-broadcast dispatched for need: ${need.title}`);
          } catch (dispatchErr) {
            console.error(`[CRON] Failed to re-broadcast need ${need.id}:`, dispatchErr.message);
          }
        }
      }

      // 3. Cleanup Redis (Remove expired or already assigned needs)
      for (const needId of needsToProcess) {
        const stillActive = pendingNeeds.find(n => n.id === needId);
        if (!stillActive) {
          await redisService.removeFromSet('needs_to_rebroadcast', needId);
        } else {
          // If it's older than 30 mins, stop re-broadcasting it
          if (stillActive.createdAt < thirtyMinutesAgo) {
            await redisService.removeFromSet('needs_to_rebroadcast', needId);
          }
        }
      }

    } catch (err) {
      console.error(`[CRON] Re-broadcast sweep failed:`, err);
    }
  }, 10 * 60 * 1000); // 10 mins check
};

module.exports = { startReBroadcastJob };

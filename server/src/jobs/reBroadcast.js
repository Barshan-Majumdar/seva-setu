const prisma = require('../config/db');
const { triggerBroadcast } = require('../services/matchingService');

/**
 * Periodically sweep for open needs that are less than 30 minutes old
 * and have not yet been assigned. Triggers a new broadcast to alert
 * any volunteers who may have just come online or moved closer.
 */
const startReBroadcastJob = () => {
  // Run every 5 minutes (300,000 ms)
  setInterval(async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      // Find all needs that are:
      // 1. Still 'open'
      // 2. Created within the last 30 minutes
      const pendingNeeds = await prisma.need.findMany({
        where: {
          status: 'open',
          createdAt: {
            gte: thirtyMinutesAgo
          }
        },
        select: { id: true, title: true }
      });

      if (pendingNeeds.length > 0) {
        console.log(`[CRON] Found ${pendingNeeds.length} open needs within the 30-min window. Re-broadcasting...`);
        for (const need of pendingNeeds) {
          try {
            await triggerBroadcast(need.id, 6);
            console.log(`[CRON] Re-broadcast dispatched for need: ${need.title}`);
          } catch (dispatchErr) {
            console.error(`[CRON] Failed to re-broadcast need ${need.id}:`, dispatchErr.message);
          }
        }
      }
    } catch (err) {
      console.error(`[CRON] Re-broadcast sweep failed:`, err);
    }
  }, 5 * 60 * 1000); // 5 minutes
};

module.exports = { startReBroadcastJob };

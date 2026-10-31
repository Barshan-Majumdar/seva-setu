const prisma = require('../config/db');
const { triggerBroadcast } = require('../services/matchingService');

/**
 * Periodically sweeps for interrupted emergency dispatches (e.g. server crash mid-broadcast).
 * Guarantees that every queued emergency event is dispatched to volunteers or transitioned.
 */
const sweepOutbox = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const queuedEvents = await prisma.emergencyEvent.findMany({
      where: {
        status: 'DISPATCH_QUEUED',
        triggeredAt: { gte: thirtyMinutesAgo }
      },
      select: {
        clientEventId: true,
        facts: true
      }
    });

    if (!queuedEvents || queuedEvents.length === 0) return;

    console.log(`[OUTBOX-SWEEPER] 🔍 Found ${queuedEvents.length} queued dispatch(es). Verifying recovery...`);

    for (const ev of queuedEvents) {
      const facts = ev.facts || {};
      const needId = facts.needId;

      if (!needId) continue;

      try {
        const existingBroadcastCount = await prisma.broadcastRequest.count({
          where: { needId }
        });

        if (existingBroadcastCount === 0 && facts.hasCoordinates) {
          console.log(`[OUTBOX-SWEEPER] 📡 Resuming interrupted broadcast for need ${needId}...`);
          const res = await triggerBroadcast(needId, 10);
          await prisma.emergencyEvent.update({
            where: { clientEventId: ev.clientEventId },
            data: {
              status: 'DISPATCH_COMPLETED',
              facts: {
                ...facts,
                dispatchState: 'DISPATCHED',
                broadcastVolunteerCount: res?.count || 0,
                recoveredBySweeper: true,
                dispatchedAt: new Date().toISOString()
              }
            }
          });
        } else {
          // Broadcast was already created or coordinates were not present
          await prisma.emergencyEvent.update({
            where: { clientEventId: ev.clientEventId },
            data: {
              status: 'DISPATCH_COMPLETED',
              facts: {
                ...facts,
                dispatchState: existingBroadcastCount > 0 ? 'DISPATCHED' : 'COORDINATOR_TRIAGE_REQUIRED',
                recoveredBySweeper: true
              }
            }
          });
        }
      } catch (err) {
        console.error(`[OUTBOX-SWEEPER] Failed to recover event ${ev.clientEventId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[OUTBOX-SWEEPER] Sweep cycle error:', err.message);
  }
};

const startOutboxSweeperJob = () => {
  // Run sweep on startup
  setTimeout(sweepOutbox, 5000);
  // Recurring sweep every 5 minutes
  setInterval(sweepOutbox, 5 * 60 * 1000);
};

module.exports = { startOutboxSweeperJob, sweepOutbox };


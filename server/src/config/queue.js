const { Queue } = require('bullmq');
const Redis = require('ioredis');

// We use the same Redis URL as the rate limiter
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  }
});

let queueErrorCount = 0;
connection.on('error', (err) => {
  if (queueErrorCount++ < 1) console.error('[BullMQ] Redis Connection Error:', err.message);
});

// Create the AI Verification Queue
const aiVerificationQueue = new Queue('ai-verification', { connection });

module.exports = {
  connection,
  aiVerificationQueue,
};

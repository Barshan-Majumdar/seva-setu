/**
 * Prisma database client instance.
 * Import this wherever you need to run queries.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

// Immediate connection check on startup
console.log('--- Initializing Database Connection ---');
prisma.$connect()
  .then(() => {
    console.log('✅ SUCCESS: Connected to Database');
  })
  .catch((err) => {
    console.error('❌ FATAL: Database connection failed!');
    console.error('Error Details:', err.message);
  });

module.exports = prisma;

/**
 * Prisma database client instance.
 * Import this wherever you need to run queries.
 */
const { PrismaClient } = require('@prisma/client');

/**
 * We DO NOT call prisma.$connect() here.
 * Prisma will lazily connect upon the first query execution.
 * This allows the Node.js process to start without waking the database,
 * enabling Neon Autosuspend to work more effectively.
 */
const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

module.exports = prisma;

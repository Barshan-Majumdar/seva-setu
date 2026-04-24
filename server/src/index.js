/**
 * SevaSetu — Server Entry Point
 * Minimal setup for Phase 1: health check + DB connectivity verification.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const prisma = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Routes ──────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const needsRoutes = require('./routes/needs');

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Use Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/needs', needsRoutes);
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/volunteers', require('./routes/volunteers'));
app.use('/api/coordinators', require('./routes/coordinators'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// ── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    // Quick DB connectivity check
    const result = await prisma.$queryRaw`SELECT NOW() AS server_time`;
    res.json({
      status: 'ok',
      timestamp: result[0].server_time,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err.message,
    });
  }
});

// ── Graceful Shutdown ────────────────────────────────────────────────
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// ── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌉 SevaSetu server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

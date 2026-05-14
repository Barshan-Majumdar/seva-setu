/**
 * SevaSetu — Server Entry Point
 * Minimal setup for Phase 1: health check + DB connectivity verification.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const prisma = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Rate Limiting & Proxy Setup ─────────────────────────────────────
// Trust proxy is required for Render/Heroku to get the correct client IP
app.set('trust proxy', 1);

const rateLimiter = require('./middleware/rateLimiter');
app.use(rateLimiter);

// ── Routes ──────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const needsRoutes = require('./routes/needs');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://seva-setu-ai.vercel.app', // Your production frontend
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin during this debugging phase, or if it's in our list
    if (!origin || allowedOrigins.some(o => origin.startsWith(o)) || true) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ── Request Logger (skip noisy polling routes) ─────────────────────
const SILENT_ROUTES = ['/api/tasks/my', '/api/volunteers/me/stats', '/api/tasks/my-broadcasts', '/api/health'];
app.use((req, res, next) => {
  const isSilent = req.method === 'GET' && SILENT_ROUTES.some(r => req.url.startsWith(r));
  if (!isSilent) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.use(express.json());
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

// ── Root Route for Deployment Testing ───────────────────────────────
app.get('/', async (req, res) => {
  let dbStatus = 'checking...';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'failed: ' + err.message;
  }

  res.json({
    message: '🌉 SevaSetu API is live!',
    db: dbStatus,
    env: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ── Use Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/needs', needsRoutes);
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/volunteers', require('./routes/volunteers'));
app.use('/api/coordinators', require('./routes/coordinators'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/volunteer-requests', require('./routes/volunteerRequests'));
app.use('/api/chat', require('./routes/chat'));

// ── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    // Quick DB connectivity check
    const result = await prisma.$queryRaw`SELECT NOW() AS server_time`;
    res.json({
      status: 'ok',
      timestamp: result[0].server_time,
      environment: process.env.NODE_ENV || 'production',
    });
  } catch (err) {
    console.error('[HEALTH] DB check failed:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err.message,
    });
  }
});

// ── Global Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER-ERROR] Uncaught exception:', err);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message, // Temporarily expose to debug production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
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

const { startReBroadcastJob } = require('./jobs/reBroadcast');

// ── Start Cron Jobs ──────────────────────────────────────────────────
try {
  startReBroadcastJob();
} catch (cronErr) {
  console.error('[CRON] Failed to start re-broadcast job:', cronErr);
}

// ── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌉 SevaSetu server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

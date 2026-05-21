const prisma = require('../config/db');
const { getClerkUser, verifyClerkJwt } = require('../services/clerkService');

const redisService = require('../services/redisService');

/**
 * Authentication Middleware
 * Validates Clerk session token from Authorization header.
 * Upserts user in local DB and attaches the DB user identity to req.user.
 *
 * IMPORTANT: This middleware NEVER overwrites the user's role if they
 * already exist in the database. Role is only set on first creation
 * (defaults to 'volunteer') and can only be changed via /api/auth/set-role.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  // ── Step 1: Verify the Clerk JWT ────────────────────────────────────
  let decoded;
  try {
    decoded = await verifyClerkJwt(token);
  } catch (err) {
    console.error('[auth] JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Token is not valid', details: err.message });
  }

  const clerkUserId = decoded.sub;
  if (!clerkUserId) {
    return res.status(401).json({ message: 'Invalid Clerk token payload' });
  }

  // ── Step 1.5: Redis Distributed Cache (Zero-CU Architecture) ──
  // Cache user context for 1 hour to completely offload auth checks from NeonDB
  try {
    const cachedUser = await redisService.getCache(`auth_user:${clerkUserId}`);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }
  } catch (err) {
    console.warn('[auth] Redis cache error:', err.message);
  }

  // ── Step 2: Optimized DB Lookup ─────────────────────────────────────
  try {
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { 
        id: true, 
        role: true, 
        email: true, 
        name: true,
        volunteer: { select: { updatedAt: true } }
      },
    });

    if (!dbUser) {
      // ── Step 2.1: Check by email (for seeded/migrated users) ────────
      const clerkUser = await getClerkUser(clerkUserId);
      const primaryEmailObj = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );
      const email = primaryEmailObj?.emailAddress;

      if (email) {
        // Use findFirst with mode: 'insensitive' to ignore case differences from Google/Clerk
        dbUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, role: true, email: true, name: true, volunteer: { select: { updatedAt: true } } }
        });

        if (dbUser) {
          // Link the Clerk ID to the existing account
          console.log(`[auth] Linking existing user ${email} to Clerk ID ${clerkUserId}`);
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { clerkId: clerkUserId }
          });
        } else {
          // ── Step 3: Fetch Clerk profile (ONLY for new users) ──────────────
          console.log(`[auth] New user detected (${email}), creating in DB...`);
          const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || 'User';

          // Check whitelist table (case-insensitive)
          const isWhitelisted = await prisma.coordinatorEmail.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          });
          
          const assignedRole = isWhitelisted ? 'coordinator' : 'user';

          try {
            dbUser = await prisma.user.create({
              data: {
                clerkId: clerkUserId,
                name,
                email,
                passwordHash: '',
                role: assignedRole,
              },
              select: { id: true, role: true, email: true, name: true },
            });
          } catch (createErr) {
            if (createErr.code === 'P2002') {
              // Race condition: another request just created the user
              dbUser = await prisma.user.findUnique({
                where: { clerkId: clerkUserId },
                select: { id: true, role: true, email: true, name: true, volunteer: { select: { updatedAt: true } } }
              });
            } else {
              throw createErr;
            }
          }

          if (dbUser.role === 'volunteer') {
            await prisma.volunteer.upsert({
              where: { userId: dbUser.id },
              create: { userId: dbUser.id, skills: [] },
              update: {},
            });
          }
        }
      } else {
        return res.status(400).json({ message: 'Clerk user has no primary email' });
      }
    }

    // ── Step 4: Throttled Heartbeat (Fire-and-forget) ───────────
    if (dbUser.role === 'volunteer') {
      if (!dbUser.volunteer) {
        await prisma.volunteer.create({ data: { userId: dbUser.id, skills: [] } });
      } else {
        const lastSeen = new Date(dbUser.volunteer.updatedAt);
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (lastSeen < fifteenMinsAgo) {
          prisma.volunteer.update({
            where: { userId: dbUser.id },
            data: { updatedAt: new Date() }
          }).catch(err => console.error('[auth] Heartbeat failed:', err.message));
        }
      }
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      email: dbUser.email,
      name: dbUser.name,
      clerkId: clerkUserId,
      isNewUser: !dbUser.volunteer // Simple heuristic or just pass true if it was newly created
    };

    // Save to Redis Distributed Cache for 1 hour (3600 seconds)
    try {
      await redisService.setCache(`auth_user:${clerkUserId}`, req.user, 3600);
    } catch (err) {
      console.warn('[auth] Failed to cache user in Redis:', err.message);
    }

    next();
  } catch (err) {
    console.error('[auth] Middleware error:', err.message);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

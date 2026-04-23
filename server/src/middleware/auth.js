const prisma = require('../db');
const { getClerkUser, verifyClerkJwt } = require('../services/clerkService');

/**
 * Authentication Middleware
 * Validates Clerk session token from Authorization header.
 * Upserts user in local DB and attaches the DB user identity to req.user.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await verifyClerkJwt(token);
    const clerkUserId = decoded.sub;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Invalid Clerk token payload' });
    }

    const clerkUser = await getClerkUser(clerkUserId);
    const primaryEmailObj = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );
    const email = primaryEmailObj?.emailAddress;

    if (!email) {
      return res.status(400).json({ message: 'Clerk user has no primary email' });
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || 'User';
    const metadataRole = clerkUser.publicMetadata?.role;
    const allowedRoles = new Set(['coordinator', 'volunteer', 'field_worker']);
    const role = allowedRoles.has(metadataRole) ? metadataRole : 'volunteer';

    const dbUser = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      create: {
        clerkId: clerkUserId,
        name,
        email,
        passwordHash: '',
        role,
      },
      update: {
        name,
        email,
        role,
      },
      select: { id: true, role: true, email: true, name: true },
    });

    if (dbUser.role === 'volunteer') {
      await prisma.volunteer.upsert({
        where: { userId: dbUser.id },
        create: {
          userId: dbUser.id,
          skills: [],
        },
        update: {},
      });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      email: dbUser.email,
      name: dbUser.name,
      clerkId: clerkUserId,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

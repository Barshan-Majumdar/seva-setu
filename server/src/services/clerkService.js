const { createClerkClient, verifyToken } = require('@clerk/backend');

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey) {
  console.warn('[auth] Missing CLERK_SECRET_KEY. Clerk auth middleware will reject requests.');
}

const clerkClient = createClerkClient({
  secretKey,
});

const verifyClerkJwt = async (token) => {
  if (!secretKey) throw new Error('Missing CLERK_SECRET_KEY');
  // clockSkewInMs: tolerate up to 30s of NTP drift between Clerk servers and our backend.
  // The JWT "iat in the future" error happens when clocks are slightly out of sync — this is normal.
  return verifyToken(token, { secretKey, clockSkewInMs: 30000 });
};

const getClerkUser = async (clerkUserId) => {
  return clerkClient.users.getUser(clerkUserId);
};

module.exports = {
  verifyClerkJwt,
  getClerkUser,
};

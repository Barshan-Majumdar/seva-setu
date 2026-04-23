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
  return verifyToken(token, { secretKey });
};

const getClerkUser = async (clerkUserId) => {
  return clerkClient.users.getUser(clerkUserId);
};

module.exports = {
  verifyClerkJwt,
  getClerkUser,
};

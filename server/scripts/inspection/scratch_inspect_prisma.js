const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('User model fields:', Object.keys(prisma.user));
  // Try to find the enum values
  try {
    const { UserRole } = require('@prisma/client');
    console.log('UserRole enum:', UserRole);
  } catch (e) {
    console.log('UserRole not found in @prisma/client');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

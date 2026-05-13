const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // List all users so you can see what's in the DB
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, clerkId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  
  console.log('All users in DB:');
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} | role: ${u.role} | clerk: ${u.clerkId ? 'yes' : 'no'}`);
  });

  // Delete the newest Clerk user (the test account) — keep the first one
  const clerkUsers = users.filter(u => u.clerkId);
  if (clerkUsers.length > 1) {
    const testUser = clerkUsers[0]; // newest
    // Delete volunteer record first if exists
    await prisma.volunteer.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log(`\nDeleted test user: ${testUser.email}`);
  } else {
    console.log('\nNo test user to delete (only 1 Clerk user exists).');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { role: 'coordinator' },
  });
  console.log(`Updated ${result.count} users to coordinator role.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

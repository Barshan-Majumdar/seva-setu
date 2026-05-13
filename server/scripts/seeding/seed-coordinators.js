const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = ['barshanmajumdar249@gmail.com', 'connect.barshan.majumdar@gmail.com'];
  for (const email of emails) {
    await prisma.coordinatorEmail.upsert({
      where: { email },
      create: { email },
      update: {},
    });
    console.log(`Whitelisted: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const needs = await prisma.$queryRaw`
    SELECT id, title, contact_number FROM needs ORDER BY created_at DESC LIMIT 5
  `;
  console.log("LATEST NEEDS:", needs);
}

run().finally(() => prisma.$disconnect());

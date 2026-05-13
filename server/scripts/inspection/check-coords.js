const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const needs = await prisma.$queryRawUnsafe('SELECT id, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM needs LIMIT 5');
  console.log(needs);
}
main().finally(() => prisma.$disconnect());

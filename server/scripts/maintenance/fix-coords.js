const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const needs = await prisma.need.findMany();
  let updated = 0;

  for (const need of needs) {
    // Generate random coordinates around Kolkata
    const lat = 22.5 + (Math.random() * 0.2 - 0.1);
    const lng = 88.3 + (Math.random() * 0.2 - 0.1);

    await prisma.$executeRawUnsafe(
      `UPDATE needs SET location = ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326) WHERE id = $3::uuid`,
      lng, lat, need.id
    );
    updated++;
  }

  console.log(`Successfully updated coordinates for ${updated} needs.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

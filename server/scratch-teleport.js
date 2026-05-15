const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Move the volunteer to be exactly 0.5km away from the Habra task
  // Habra task coords: lng 88.540429, lat 22.922196
  // Moving volunteer to: lng 88.545, lat 22.922
  
  await prisma.$executeRaw`
    UPDATE volunteers 
    SET location = ST_SetSRID(ST_MakePoint(88.545::float, 22.922::float), 4326),
        updated_at = now()
  `;

  console.log("✅ Moved all volunteers to the Habra testing zone (0.5km from task).");
}

main().finally(() => prisma.$disconnect());

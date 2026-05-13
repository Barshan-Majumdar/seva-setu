const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const needs = await prisma.$queryRaw`
    SELECT id, title, status, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM needs
  `;
  console.log("--- NEEDS LOCATIONS ---");
  needs.forEach(n => {
    console.log(`[${n.status}] ${n.title}: Lat=${n.lat}, Lng=${n.lng}`);
  });
  
  const tasks = await prisma.task.findMany({
    where: { status: 'in_progress' },
    include: { need: true }
  });
  console.log("\n--- IN PROGRESS TASKS ---");
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id} for Need: ${t.need.title}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

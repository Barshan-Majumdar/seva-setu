const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tasks = await prisma.$queryRaw`
    SELECT t.id, t.status, n.title, n.contact_number 
    FROM tasks t
    JOIN needs n ON t.need_id = n.id
    ORDER BY t.assigned_at DESC LIMIT 5
  `;
  console.log("LATEST TASKS:", tasks);
}

run().finally(() => prisma.$disconnect());

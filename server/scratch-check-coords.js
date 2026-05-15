const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.$queryRaw`
    SELECT 
      t.id, 
      ST_X(n.location::geometry) as n_lng, 
      ST_Y(n.location::geometry) as n_lat, 
      ST_X(v.location::geometry) as v_lng, 
      ST_Y(v.location::geometry) as v_lat, 
      ST_Distance(v.location::geography, n.location::geography) / 1000 as dist_km 
    FROM tasks t 
    JOIN needs n ON t.need_id = n.id 
    JOIN volunteers v ON t.assigned_volunteer_id = v.user_id
  `;
  console.log(tasks);
}

main().finally(() => prisma.$disconnect());

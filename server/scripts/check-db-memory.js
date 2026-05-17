const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMemory() {
  console.log('--- Neon DB Internal Memory Settings ---');
  try {
    const settings = await prisma.$queryRaw`
      SELECT name, setting, unit 
      FROM pg_settings 
      WHERE name IN (
        'shared_buffers', 
        'work_mem', 
        'maintenance_work_mem', 
        'max_connections',
        'effective_cache_size'
      )
    `;
    console.table(settings);

    const dbSize = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
    `;
    console.log('Actual Data Size on Disk:', dbSize[0].total_size);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMemory();

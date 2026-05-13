const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVolunteers() {
  try {
    const volunteers = await prisma.volunteer.findMany({
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    
    console.log('Last 10 updated volunteers:');
    volunteers.forEach(v => {
      console.log(`User: ${v.user.name}, Available: ${v.isAvailable}, UpdatedAt: ${v.updatedAt}`);
    });
    
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const activeCount = volunteers.filter(v => v.isAvailable && v.updatedAt > twoHoursAgo).length;
    console.log(`\nActive Volunteers (last 2h + Available): ${activeCount}`);
    console.log(`Current Time (UTC): ${now.toISOString()}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkVolunteers();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const totalUsers = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });
    
    console.log('--- DATABASE USER CHECK ---');
    console.log(`Total User Count: ${totalUsers}`);
    console.log('\nUser Details:');
    users.forEach((u, i) => {
      console.log(`${i+1}. [${u.role}] ${u.name} (${u.email})`);
    });
    console.log('---------------------------');
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();

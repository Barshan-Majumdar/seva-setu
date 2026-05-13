const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { assignedAt: 'asc' }
    });

    const seenNeeds = new Set();
    const duplicateTaskIds = [];

    for (const task of tasks) {
      if (seenNeeds.has(task.needId)) {
        duplicateTaskIds.push(task.id);
      } else {
        seenNeeds.add(task.needId);
      }
    }

    if (duplicateTaskIds.length > 0) {
      console.log(`Found ${duplicateTaskIds.length} duplicate tasks. Deleting...`);
      await prisma.task.deleteMany({
        where: { id: { in: duplicateTaskIds } }
      });
      console.log('Duplicates removed.');
    } else {
      console.log('No duplicate tasks found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();

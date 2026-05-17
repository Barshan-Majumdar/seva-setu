const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnections() {
  try {
    console.log('--- Database Connection Debug ---');
    
    // 1. Check current activity
    const activity = await prisma.$queryRaw`
      SELECT 
        pid, 
        usename, 
        application_name, 
        client_addr, 
        state, 
        query,
        backend_start
      FROM pg_stat_activity 
      WHERE datname = current_database()
      ORDER BY backend_start DESC;
    `;

    console.log(`Found ${activity.length} active database backends:\n`);
    
    activity.forEach((conn, i) => {
      console.log(`Connection #${i + 1}:`);
      console.log(`- PID: ${conn.pid}`);
      console.log(`- App: ${conn.application_name || 'unknown'}`);
      console.log(`- State: ${conn.state}`);
      console.log(`- Last Query: ${conn.query.substring(0, 100)}${conn.query.length > 100 ? '...' : ''}`);
      console.log(`- Started: ${conn.backend_start}`);
      console.log('---------------------------');
    });

    // 2. Summary by state
    const summary = await prisma.$queryRaw`
      SELECT state, count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state;
    `;
    
    console.log('\nSummary by state:');
    summary.forEach(s => console.log(`${s.state || 'unknown'}: ${s.count}`));

  } catch (err) {
    console.error('Error checking connections:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnections();

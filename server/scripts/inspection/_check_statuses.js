const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe('SELECT status, count(*)::int as cnt FROM needs GROUP BY status');
  console.log('Status distribution:');
  for (const row of rows) {
    console.log('  ', row.status, ':', row.cnt);
  }
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

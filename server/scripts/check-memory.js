function checkMemory() {
  const used = process.memoryUsage();
  console.log('--- Memory Usage Report ---');
  for (let key in used) {
    console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
  
  console.log('\n--- Explanations ---');
  console.log('rss: Resident Set Size (Total memory allocated for the process)');
  console.log('heapTotal: Total size of the allocated heap');
  console.log('heapUsed: Actual memory used during execution');
  console.log('external: Memory used by C++ objects (like Buffers or Prisma engine)');
}

checkMemory();

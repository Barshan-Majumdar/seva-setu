const { findMatches } = require('./src/services/matchingService');

async function test() {
  try {
    const matches = await findMatches('82d25d56-1f92-4596-bf71-d62413dabd03');
    console.log("MATCHES:", matches);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test().then(() => process.exit(0));

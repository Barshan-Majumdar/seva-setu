const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const needs = await prisma.$queryRaw`
    SELECT id, title, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM needs ORDER BY created_at DESC LIMIT 1
  `;
  console.log("LATEST NEED:", needs);

  if (needs.length > 0) {
    const { lat, lng } = needs[0];
    const vols = await prisma.$queryRaw`
      SELECT
        u.name,
        v.is_available,
        ST_X(v.location::geometry) as v_lng,
        ST_Y(v.location::geometry) as v_lat,
        ST_Distance(v.location::geography, ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography) / 1000 AS distance_km
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
      WHERE v.location IS NOT NULL
    `;
    console.log("VOLUNTEERS:", vols);
  }
}

run().finally(() => prisma.$disconnect());

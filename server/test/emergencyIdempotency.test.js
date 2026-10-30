const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/db');

// Helper to send HTTP requests to local server
async function postJson(path, body) {
  const res = await fetch(`http://localhost:5000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

test('=== EMERGENCY BACKEND IDEMPOTENCY & RESILIENCE SUITE ===', async (t) => {
  const testIds = [];

  t.after(async () => {
    // Cleanup created test records
    for (const id of testIds) {
      try {
        const ev = await prisma.emergencyEvent.findUnique({ where: { clientEventId: id } });
        const needId = ev?.facts?.needId;
        if (needId) {
          await prisma.need.delete({ where: { id: needId } }).catch(() => {});
        }
        await prisma.emergencyEvent.delete({ where: { clientEventId: id } }).catch(() => {});
      } catch (_) {}
    }
  });

  await t.test('1. Authoritative Concurrency: 5 concurrent requests create exactly 1 Need row', async () => {
    const clientEventId = `test-concurrent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    testIds.push(clientEventId);

    // Initial trigger
    await postJson('/api/emergency/trigger', {
      clientEventId,
      lat: 22.5726,
      lng: 88.3639,
      accuracy: 25
    });

    // Fire 5 simultaneous facts requests with identical clientEventId
    const factsPayload = {
      intent: 'MEDICAL',
      facts: {
        peopleCount: 5,
        injuredCount: 5,
        severitySignals: ['injury'],
        landmark: 'Near Station'
      },
      location: {
        lat: 22.5726,
        lng: 88.3639,
        accuracy: 25
      }
    };

    const results = await Promise.all([
      postJson(`/api/emergency/${clientEventId}/facts`, factsPayload),
      postJson(`/api/emergency/${clientEventId}/facts`, factsPayload),
      postJson(`/api/emergency/${clientEventId}/facts`, factsPayload),
      postJson(`/api/emergency/${clientEventId}/facts`, factsPayload),
      postJson(`/api/emergency/${clientEventId}/facts`, factsPayload),
    ]);

    // All 5 must succeed with status 200
    for (const r of results) {
      assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
      assert.ok(r.data.needId, 'Must return a needId');
    }

    // All 5 must return the EXACT same needId
    const primaryNeedId = results[0].data.needId;
    for (const r of results) {
      assert.equal(r.data.needId, primaryNeedId, 'All concurrent calls must return identical needId');
    }

    // Database verification: Verify exactly 1 Need exists in PostgreSQL
    const matchingNeeds = await prisma.need.findMany({
      where: { id: primaryNeedId }
    });
    assert.equal(matchingNeeds.length, 1, 'Exactly 1 Need row must exist in the database');
    assert.equal(matchingNeeds[0].needType, 'medical');
    assert.equal(matchingNeeds[0].peopleAffected, 5);
  });

  await t.test('2. GPS Resilience: Submitting with null coordinates creates Need without crashing', async () => {
    const clientEventId = `test-nullgps-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    testIds.push(clientEventId);

    // Trigger with null GPS
    const trigRes = await postJson('/api/emergency/trigger', {
      clientEventId,
      lat: null,
      lng: null
    });
    assert.equal(trigRes.status, 200);

    // Facts with null GPS
    const factsRes = await postJson(`/api/emergency/${clientEventId}/facts`, {
      intent: 'FIRE',
      facts: {
        fire: true,
        peopleCount: 3,
        landmark: 'Howrah Bridge Market'
      },
      location: null
    });

    assert.equal(factsRes.status, 200);
    assert.equal(factsRes.data.hasCoordinates, false);
    assert.ok(factsRes.data.needId, 'Need must be created even without GPS');

    // Database verification: Location column is null, description notes GPS unavailable
    const dbNeed = await prisma.need.findUnique({
      where: { id: factsRes.data.needId }
    });
    assert.ok(dbNeed, 'Need must exist in DB');
    assert.ok(dbNeed.description.includes('GPS Coordinates Unavailable'), 'Description must warn that GPS is unavailable');
    assert.equal(dbNeed.needType, 'rescue'); // Fire maps to rescue
  });

  await t.test('3. EDC Trigger: Mapped to category other without arbitrary hardcoding', async () => {
    const clientEventId = `test-edc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    testIds.push(clientEventId);

    const factsRes = await postJson(`/api/emergency/${clientEventId}/facts`, {
      intent: 'EDC',
      facts: {
        severitySignals: ['edc'],
        peopleCount: 4
      },
      location: { lat: 22.58, lng: 88.35, accuracy: 20 }
    });

    assert.equal(factsRes.status, 200);
    const dbNeed = await prisma.need.findUnique({
      where: { id: factsRes.data.needId }
    });
    assert.equal(dbNeed.needType, 'other', 'EDC must map to needType other');
    assert.ok(dbNeed.description.includes('Trigger: EDC'), 'Must note EDC trigger in description');
  });

});


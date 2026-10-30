const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/db');
const { findMatches, findBroadcastCandidates, triggerBroadcast } = require('../src/services/matchingService');

test('=== VOLUNTEER AVAILABILITY & ZERO-RELIABILITY MATCHING SUITE ===', async (t) => {
  let needId = null;
  const userIds = [];

  t.before(async () => {
    // 1. Create a test need in Kolkata center
    const testNeed = await prisma.need.create({
      data: {
        title: 'Matching Test Emergency',
        description: 'Test situation for matching logic',
        needType: 'medical',
        priorityLevel: 'High',
        urgencyScore: 90.0,
        status: 'open'
      }
    });
    needId = testNeed.id;

    await prisma.$executeRaw`
      UPDATE needs
      SET location = ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)::geometry
      WHERE id = ${needId}::uuid
    `;
  });

  t.after(async () => {
    // Cleanup
    if (needId) {
      await prisma.broadcastRequest.deleteMany({ where: { needId } }).catch(() => {});
      await prisma.need.delete({ where: { id: needId } }).catch(() => {});
    }
    for (const uid of userIds) {
      await prisma.volunteer.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
  });

  await t.test('1. Single Available Volunteer with 0% Reliability gets job without ranking', async () => {
    const uid = `00000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`.slice(0, 36);
    userIds.push(uid);

    await prisma.user.create({
      data: {
        id: uid,
        clerkId: `clerk_newvol_${Date.now()}`,
        name: 'Brand New Volunteer',
        role: 'volunteer',
        phoneNumber: '+919999900001',
        email: `newvol.${Date.now()}@test.local`,
        passwordHash: '$2b$10$dummy'
      }
    });

    // Available, 0 completed tasks, 0.0 completion rate
    await prisma.volunteer.create({
      data: {
        userId: uid,
        isAvailable: true,
        skills: ['medical'],
        tasksCompleted: 0,
        completionRate: 0.0
      }
    });

    await prisma.$executeRaw`
      UPDATE volunteers
      SET location = ST_SetSRID(ST_MakePoint(88.3650, 22.5730), 4326)::geometry
      WHERE user_id = ${uid}::uuid
    `;

    // Make sure other test users are not available during this test
    const matches = await findMatches(needId);
    assert.ok(matches.length >= 1, 'Should find at least 1 match');

    const targetMatch = matches.find(m => m.id === uid);
    assert.ok(targetMatch, 'Single available volunteer must be in matches');

    if (matches.length === 1) {
      assert.equal(targetMatch.ranking_applied, false, 'No ranking should be applied for single available volunteer');
      assert.equal(targetMatch.match_score, 100, 'Score should be 100 without reliability penalty');
    } else {
      // If multiple exist in local DB, verify new volunteer is not penalized to 0 for reliability
      assert.ok(targetMatch.match_score > 30, 'Score should reflect fair baseline reliability');
    }
  });

  await t.test('2. No one nearby available: Fallback to distant available volunteer', async () => {
    const distUid = `00000000-0000-4000-b000-${Date.now().toString(16).padStart(12, '0')}`.slice(0, 36);
    userIds.push(distUid);

    await prisma.user.create({
      data: {
        id: distUid,
        clerkId: `clerk_distant_${Date.now()}`,
        name: 'Distant Available Volunteer',
        role: 'volunteer',
        phoneNumber: '+919999900002',
        email: `distant.${Date.now()}@test.local`,
        passwordHash: '$2b$10$dummy'
      }
    });

    // Geolocation ~50km away in another district (e.g. Burdwan/Howrah rural)
    await prisma.volunteer.create({
      data: {
        userId: distUid,
        isAvailable: true,
        skills: ['general'],
        tasksCompleted: 0,
        completionRate: 0.0
      }
    });

    await prisma.$executeRaw`
      UPDATE volunteers
      SET location = ST_SetSRID(ST_MakePoint(87.8550, 23.2324), 4326)::geometry
      WHERE user_id = ${distUid}::uuid
    `;

    // Create a need far away where no one is within 6km
    const farNeed = await prisma.need.create({
      data: {
        title: 'Remote Need Without Nearby Volunteers',
        description: 'Deep rural location',
        needType: 'rescue',
        priorityLevel: 'High',
        urgencyScore: 88.0,
        status: 'open'
      }
    });

    // Place need in Siliguri (~500km away) where no one is nearby
    await prisma.$executeRaw`
      UPDATE needs
      SET location = ST_SetSRID(ST_MakePoint(88.4200, 26.7200), 4326)::geometry
      WHERE id = ${farNeed.id}::uuid
    `;

    try {
      const candidates = await findBroadcastCandidates(farNeed.id, 6);
      assert.ok(candidates.length > 0, 'Should fall back to available volunteers when none are nearby');
      const hasDistant = candidates.some(c => c.id === distUid);
      assert.ok(hasDistant, 'Distant available volunteer must be included via fallback');
    } finally {
      await prisma.need.delete({ where: { id: farNeed.id } }).catch(() => {});
    }
  });
});


const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/db');

// Helper to send HTTP requests to local server
async function postServer(path, body) {
  const res = await fetch(`http://localhost:5000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Helper to query AI Microservice
async function postAiService(transcript) {
  const res = await fetch('http://localhost:8000/extract-facts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, language: 'en-IN' })
  });
  const data = await res.json();
  return { status: res.status, data };
}

test('=== SEVASETU END-TO-END VOICE AUTODISPATCH & VOLUNTEER NOTIFICATION SUITE ===', async (t) => {
  const testIds = [];
  const testNeedIds = [];
  let testVolunteerUserId = null;

  // Set up mock volunteer in Kolkata area to receive broadcast dispatch
  t.before(async () => {
    testVolunteerUserId = `00000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`.slice(0, 36);

    // 1. Create test volunteer user
    await prisma.user.create({
      data: {
        id: testVolunteerUserId,
        clerkId: `clerk_test_volunteer_${Date.now()}`,
        name: 'Auto-Dispatch Test Volunteer',
        role: 'volunteer',
        phoneNumber: '+919876543210',
        email: `volunteer.${Date.now()}@sevasetu.test`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890dummyhash'
      }
    });

    // 2. Create volunteer profile with location and skills
    await prisma.volunteer.create({
      data: {
        userId: testVolunteerUserId,
        isAvailable: true,
        skills: ['medical', 'rescue', 'food', 'shelter', 'other'],
        tasksCompleted: 10,
        completionRate: 0.95
      }
    });

    // 3. Set PostGIS location geometry for volunteer (Kolkata center: 88.3639, 22.5726)
    await prisma.$executeRaw`
      UPDATE volunteers
      SET location = ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)::geometry
      WHERE user_id = ${testVolunteerUserId}::uuid
    `;
    console.log('[TEST SETUP] ✅ Test Volunteer created and geolocated in Kolkata.');
  });

  t.after(async () => {
    console.log('[TEST CLEANUP] Cleaning up test records...');
    // Delete broadcasts
    for (const needId of testNeedIds) {
      await prisma.broadcastRequest.deleteMany({ where: { needId } }).catch(() => {});
      await prisma.need.delete({ where: { id: needId } }).catch(() => {});
    }

    // Delete emergency events
    for (const clientEventId of testIds) {
      await prisma.emergencyEvent.delete({ where: { clientEventId } }).catch(() => {});
    }

    // Delete test volunteer
    if (testVolunteerUserId) {
      await prisma.volunteer.deleteMany({ where: { userId: testVolunteerUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testVolunteerUserId } }).catch(() => {});
    }
    console.log('[TEST CLEANUP] ✅ Cleanup completed.');
  });

  await t.test('1. Core Prompt: Speech -> NLP -> Need -> Volunteer Proximity Notification', async () => {
    const rawUtterance = "Hey SevaSetu. Medical emergency. Five people are injured. Please send help.";
    const clientEventId = `test-e2e-voice-${Date.now()}`;
    testIds.push(clientEventId);

    // Strip wake prefix (simulating VoiceController speech pipeline)
    const cleanedSpeech = rawUtterance.replace(/^Hey\s+SevaSetu[.,!]?\s*/i, '').trim();
    assert.equal(cleanedSpeech, "Medical emergency. Five people are injured. Please send help.");

    // Step A: Extract Facts from AI Service (Port 8000)
    const aiRes = await postAiService(cleanedSpeech);
    assert.equal(aiRes.status, 200, 'AI Service must return 200');
    assert.equal(aiRes.data.intent, 'MEDICAL', 'Intent must be MEDICAL');
    assert.equal(aiRes.data.isEmergency, true, 'isEmergency must be true');
    assert.equal(aiRes.data.facts.peopleCount, 5, 'peopleCount must be 5');
    assert.equal(aiRes.data.facts.injuredCount, 5, 'injuredCount must be 5');
    assert.ok(aiRes.data.facts.severitySignals.includes('injury'), 'severitySignals must include injury');

    // Step B: Minimum SOS Ingestion (Trigger)
    const triggerRes = await postServer('/api/emergency/trigger', {
      clientEventId,
      triggerType: 'VOICE_WAKE',
      source: 'VOICE',
      lat: 22.5726,
      lng: 88.3639,
      accuracy: 10
    });
    assert.equal(triggerRes.status, 200, 'Trigger API must return 200');
    assert.equal(triggerRes.data.clientEventId, clientEventId);

    // Step C: Auto-Dispatch Facts Ingestion (Zero-Tap Voice Commitment)
    const factsRes = await postServer(`/api/emergency/${clientEventId}/facts`, {
      intent: aiRes.data.intent,
      facts: aiRes.data.facts,
      confidenceByField: aiRes.data.confidenceByField,
      location: {
        lat: 22.5726,
        lng: 88.3639,
        accuracy: 10
      }
    });

    assert.equal(factsRes.status, 200, 'Facts API must return 200');
    assert.ok(factsRes.data.needId, 'Must return a generated needId');
    assert.equal(factsRes.data.hasCoordinates, true, 'hasCoordinates must be true');
    assert.equal(factsRes.data.status, 'URGENCY_CALCULATED');
    testNeedIds.push(factsRes.data.needId);

    // Step D: Verify Need Invariants in PostgreSQL
    const createdNeed = await prisma.need.findUnique({
      where: { id: factsRes.data.needId }
    });
    assert.ok(createdNeed, 'Need must exist in PostgreSQL');
    assert.equal(createdNeed.needType, 'medical', 'Need type must be mapped to medical');
    assert.equal(createdNeed.peopleAffected, 5, 'peopleAffected must be exactly 5');
    assert.ok(['High', 'Medium', 'Critical', 'critical', 'high'].includes(createdNeed.priorityLevel), 'Priority must be High or Medium');

    // Step E: Verify Volunteer Notification Initiation (BroadcastRequest row created)
    // Wait briefly for asynchronous proximity matching to complete
    let broadcastFound = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      const broadcasts = await prisma.broadcastRequest.findMany({
        where: {
          needId: factsRes.data.needId,
          volunteerId: testVolunteerUserId
        }
      });
      if (broadcasts.length > 0) {
        broadcastFound = true;
        assert.equal(broadcasts[0].status, 'pending', 'Broadcast status must be pending');
        assert.ok(broadcasts[0].distanceKm < 1.0, 'Volunteer proximity distance must be calculated');
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    assert.ok(broadcastFound, 'Proximity broadcast request must be initiated for nearby volunteer');

    // Step F: Verify EmergencyEvent status updated
    const finalEvent = await prisma.emergencyEvent.findUnique({
      where: { clientEventId }
    });
    assert.ok(finalEvent.facts?.needId, 'Facts must record needId');
  });

  await t.test('2. Priority Categories: Fire, Rescue, Accident, Flood, EDC & Help', async () => {
    const categories = [
      { text: "Fire broke out on the second floor, people trapped", expectedType: 'rescue', minUrgency: 9.0 },
      { text: "Building collapsed, rescue team needed urgently", expectedType: 'rescue', minUrgency: 9.0 },
      { text: "Severe car accident with injuries on highway", expectedType: 'accidental', minUrgency: 8.0 },
      { text: "Flood water rising fast, stranded families", expectedType: 'rescue', minUrgency: 5.0 },
      { text: "EDC dispatch required for critical incident coordination", expectedType: 'other', minUrgency: 1.0 },
      { text: "Help emergency, need assistance immediately", expectedType: 'other', minUrgency: 1.0 },
    ];

    for (const cat of categories) {
      const clientEventId = `test-cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      testIds.push(clientEventId);

      // AI Service Fact Extraction
      const aiRes = await postAiService(cat.text);
      assert.equal(aiRes.status, 200);

      // Trigger
      await postServer('/api/emergency/trigger', {
        clientEventId,
        lat: 22.5726,
        lng: 88.3639
      });

      // Facts
      const factsRes = await postServer(`/api/emergency/${clientEventId}/facts`, {
        intent: aiRes.data.intent,
        facts: aiRes.data.facts,
        location: { lat: 22.5726, lng: 88.3639 }
      });

      assert.equal(factsRes.status, 200);
      assert.ok(factsRes.data.needId);
      testNeedIds.push(factsRes.data.needId);

      const need = await prisma.need.findUnique({ where: { id: factsRes.data.needId } });
      assert.ok(need);
      assert.equal(need.needType, cat.expectedType, `Category for "${cat.text}" must map to ${cat.expectedType}`);
      assert.ok(need.urgencyScore >= cat.minUrgency, `Urgency must be at least ${cat.minUrgency}`);
    }
  });

  await t.test('3. GPS Resilience: Zero fake coordinates & Coordinator Triage Escalation', async () => {
    const clientEventId = `test-e2e-nogps-${Date.now()}`;
    testIds.push(clientEventId);

    const aiRes = await postAiService("Medical emergency, ambulance needed right now");

    await postServer('/api/emergency/trigger', {
      clientEventId,
      lat: null,
      lng: null
    });

    const factsRes = await postServer(`/api/emergency/${clientEventId}/facts`, {
      intent: aiRes.data.intent,
      facts: aiRes.data.facts,
      location: null
    });

    assert.equal(factsRes.status, 200);
    assert.equal(factsRes.data.hasCoordinates, false);
    assert.equal(factsRes.data.status, 'COORDINATOR_TRIAGE_REQUIRED');
    testNeedIds.push(factsRes.data.needId);

    const need = await prisma.need.findUnique({ where: { id: factsRes.data.needId } });
    assert.ok(need);
    assert.ok(need.description.includes('GPS Coordinates Unavailable'));

    const ev = await prisma.emergencyEvent.findUnique({ where: { clientEventId } });
    assert.ok(ev);
    assert.equal(ev.facts.dispatchState, 'COORDINATOR_TRIAGE_REQUIRED');
  });

  await t.test('4. Safety & False Alarm Cancellation Lifecycle', async () => {
    const clientEventId = `test-e2e-cancel-${Date.now()}`;
    testIds.push(clientEventId);

    // Initial Trigger & Facts
    await postServer('/api/emergency/trigger', {
      clientEventId,
      lat: 22.5726,
      lng: 88.3639
    });

    const factsRes = await postServer(`/api/emergency/${clientEventId}/facts`, {
      intent: 'MEDICAL',
      facts: { severitySignals: ['injury'], peopleCount: 1 },
      location: { lat: 22.5726, lng: 88.3639 }
    });
    assert.equal(factsRes.status, 200);
    testNeedIds.push(factsRes.data.needId);

    // User declares safe or aborts session
    const cancelRes = await postServer(`/api/emergency/${clientEventId}/cancel`, {
      reason: 'USER_DECLARED_SAFE'
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.status, 'CANCELLED');

    // Database verification: EmergencyEvent is CANCELLED, Need is archived
    const ev = await prisma.emergencyEvent.findUnique({ where: { clientEventId } });
    assert.equal(ev.status, 'CANCELLED');
    assert.equal(ev.facts.cancellationReason, 'USER_DECLARED_SAFE');

    const need = await prisma.need.findUnique({ where: { id: factsRes.data.needId } });
    assert.equal(need.status, 'archived');
  });
});

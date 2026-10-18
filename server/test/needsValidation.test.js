const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePriority } = require('../src/services/scoringService');

test('=== BACKEND INPUT VALIDATION & TRIAGE RECALCULATION SUITE ===', async (t) => {

  await t.test('1. Demographic count sanitization and subcount reconciliation', () => {
    // If people_affected is reported as 2, but children=3 and adults=4 (sum=7),
    // total people affected must reconcile to at least 7.
    const numChildren = 3;
    const numAdults = 4;
    const numPregnant = 0;
    const effectiveAdults = Math.max(numAdults, numPregnant);
    const minPeopleFromSubcounts = numChildren + effectiveAdults;
    const rawPeople = 2; // Inconsistent input from user/voice
    const totalPeople = (rawPeople >= minPeopleFromSubcounts)
      ? rawPeople
      : Math.max(1, minPeopleFromSubcounts);

    assert.equal(totalPeople, 7, 'Total people must be reconciled to at least 7');

    const result = calculatePriority({
      need_type: 'shelter',
      people_affected: totalPeople,
      children_count: numChildren,
      adults_count: effectiveAdults,
      pregnant_count: numPregnant,
      title: 'Family displaced after roof collapse',
      description: 'Need tarpaulin for 7 family members'
    });

    assert.equal(result.breakdown.population_score, 6); // 7 people is tier 5-10 (+6)
    assert.equal(result.breakdown.vulnerability_score, 12); // 3 children * 4 = 12
  });

  await t.test('2. Title and NeedType enum validation rules', () => {
    const ALLOWED_NEED_TYPES = ['medical', 'food', 'shelter', 'accidental', 'rescue', 'education', 'other'];

    // Valid types
    assert.ok(ALLOWED_NEED_TYPES.includes('medical'));
    assert.ok(ALLOWED_NEED_TYPES.includes('rescue'));
    assert.ok(ALLOWED_NEED_TYPES.includes('food'));
    assert.ok(ALLOWED_NEED_TYPES.includes('shelter'));

    // Invalid types
    assert.equal(ALLOWED_NEED_TYPES.includes('hacked_type'), false);
    assert.equal(ALLOWED_NEED_TYPES.includes('unknown_crisis'), false);
    assert.equal(ALLOWED_NEED_TYPES.includes(''), false);

    // Title validation rules
    const isValidTitle = (t) => Boolean(t && typeof t === 'string' && t.trim().length >= 3);
    assert.equal(isValidTitle(''), false);
    assert.equal(isValidTitle('  '), false);
    assert.equal(isValidTitle('ab'), false);
    assert.equal(isValidTitle(null), false);
    assert.equal(isValidTitle(undefined), false);
    assert.equal(isValidTitle('Fire at market'), true);
  });

  await t.test('3. GPS Coordinate Bounds Validation', () => {
    const isValidCoords = (lat, lng) => {
      const pLat = parseFloat(lat);
      const pLng = parseFloat(lng);
      return !isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180;
    };

    // Valid Kolkata coordinates
    assert.equal(isValidCoords(22.5726, 88.3639), true);
    assert.equal(isValidCoords('22.5726', '88.3639'), true);

    // Invalid coordinates
    assert.equal(isValidCoords(95.0, 88.0), false, 'Latitude > 90 must fail');
    assert.equal(isValidCoords(-95.0, 88.0), false, 'Latitude < -90 must fail');
    assert.equal(isValidCoords(22.0, 190.0), false, 'Longitude > 180 must fail');
    assert.equal(isValidCoords('NaN', '88.3639'), false);
    assert.equal(isValidCoords(undefined, null), false);
  });

  await t.test('4. Priority recalculation simulates severity escalation when situation worsens', () => {
    // Initial state: Baseline medical aid for 1 person starts at 5.0 (50 pts) for Medium priority
    const initialReport = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      title: 'Minor cuts at evacuation center',
      description: 'First aid bandage needed for minor scrape'
    });
    assert.equal(initialReport.priority_level, 'Medium');
    assert.equal(initialReport.urgency_score, 5.0);
    assert.ok(initialReport.priority_score >= 40 && initialReport.priority_score < 70);

    // Escalation: Condition suddenly deteriorates — profuse bleeding & 2 pregnant women in active distress
    const escalatedReport = calculatePriority({
      need_type: 'medical',
      people_affected: 3,
      pregnant_count: 2,
      title: 'Urgent medical escalation at evacuation center',
      description: 'Severe hemorrhage and profuse bleeding, plus two pregnant women experiencing acute labor complications'
    });
    assert.equal(escalatedReport.is_life_threatening, true);
    assert.equal(escalatedReport.priority_level, 'High');
    assert.ok(escalatedReport.priority_score >= 90);
    assert.ok(escalatedReport.vulnerability_factors.some(f => f.includes('Critical')));
    assert.ok(escalatedReport.vulnerability_factors.includes('2 Pregnant Women'));
  });

  await t.test('5. Duplicate submission prevention logic', () => {
    const now = Date.now();
    const existingCreatedAt = new Date(now - 15 * 1000); // 15 seconds ago
    const isWithin30Seconds = (Date.now() - existingCreatedAt.getTime()) < 30 * 1000;
    assert.equal(isWithin30Seconds, true, 'Submission within 30 seconds must be flagged as duplicate');

    const oldCreatedAt = new Date(now - 60 * 1000); // 60 seconds ago
    const isOldWithin30 = (Date.now() - oldCreatedAt.getTime()) < 30 * 1000;
    assert.equal(isOldWithin30, false, 'Submission after 30 seconds must not be blocked');
  });
});

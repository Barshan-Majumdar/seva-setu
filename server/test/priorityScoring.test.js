const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculatePriority,
  calculateScore,
  analyzeVulnerability,
  calculatePopulationScore,
  SCORING_CONFIG,
  PATTERNS
} = require('../src/services/scoringService');

test('=== PRIORITY SCORING TEST SUITE ===', async (t) => {

  await t.test('1. Immediate Life Threats trigger guaranteed High priority and min score 90', () => {
    // 1A. Single person trapped under debris / collapsed building
    const trappedIncident = calculatePriority({
      need_type: 'rescue',
      people_affected: 1,
      title: 'Building collapsed after quake',
      description: 'One person trapped under heavy rubble and concrete debris',
    });
    assert.equal(trappedIncident.is_life_threatening, true);
    assert.equal(trappedIncident.priority_level, 'High');
    assert.ok(trappedIncident.priority_score >= 90, `Expected score >= 90, got ${trappedIncident.priority_score}`);
    assert.ok(trappedIncident.urgency_score >= 9.0, `Expected urgency >= 9.0, got ${trappedIncident.urgency_score}`);
    assert.ok(trappedIncident.vulnerability_factors.some(f => f.includes('Trapped')));

    // 1B. Active fire with explosion
    const fireIncident = calculatePriority({
      need_type: 'rescue',
      people_affected: 2,
      title: 'Massive cylinder blast',
      description: 'Active fire spreading rapidly inside residential building, flames spreading',
    });
    assert.equal(fireIncident.is_life_threatening, true);
    assert.equal(fireIncident.priority_level, 'High');
    assert.ok(fireIncident.priority_score >= 90);

    // 1C. Critical medical emergency: cardiac arrest & profuse bleeding
    const medicalCritical = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      title: 'Severe trauma accident victim',
      description: 'Victim is unconscious with arterial bleed and severe bleeding, needs ambulance immediately',
    });
    assert.equal(medicalCritical.is_life_threatening, true);
    assert.equal(medicalCritical.priority_level, 'High');
    assert.ok(medicalCritical.priority_score >= 90);

    // 1D. Imminent delivery in disaster conditions
    const deliveryEmergency = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      pregnant_count: 1,
      title: 'Imminent childbirth at relief shelter',
      description: 'Expecting mother in active labor with severe complications, delivery in progress',
    });
    assert.equal(deliveryEmergency.is_life_threatening, true);
    assert.equal(deliveryEmergency.priority_level, 'High');
    assert.ok(deliveryEmergency.priority_score >= 90);
  });

  await t.test('2. Population sizes scale smoothly on tiered curve without drowning individual emergencies', () => {
    // 1 person
    assert.equal(calculatePopulationScore(1), 0);
    // 3 people
    assert.equal(calculatePopulationScore(3), 3);
    // 8 people
    assert.equal(calculatePopulationScore(8), 6);
    // 20 people
    assert.equal(calculatePopulationScore(20), 9);
    // 40 people
    assert.equal(calculatePopulationScore(40), 12);
    // 100 people
    assert.ok(calculatePopulationScore(100) >= 12 && calculatePopulationScore(100) <= 15);
    // 1000 people
    assert.equal(calculatePopulationScore(1000), 15);

    // Verify small group vs large group on routine relief
    const smallFood = calculatePriority({
      need_type: 'food',
      people_affected: 2,
      title: 'Food ration depleted',
      description: 'Need grain packet for small family'
    });
    const largeFood = calculatePriority({
      need_type: 'food',
      people_affected: 500,
      title: 'Community kitchen supplies depleted',
      description: 'Need rations for entire community of 500 displaced survivors'
    });
    assert.ok(largeFood.priority_score > smallFood.priority_score);
    assert.equal(largeFood.breakdown.population_score, 15);
  });

  await t.test('3. Vulnerable Groups: Infants, Children, Pregnant Women, Elderly', () => {
    // 3A. Infants
    const infantNeed = calculatePriority({
      need_type: 'food',
      people_affected: 2,
      title: 'Baby formula needed',
      description: 'Newborn baby and infant formula packets urgently needed'
    });
    assert.ok(infantNeed.vulnerability_factors.includes('Infants / Newborns'));
    assert.ok(infantNeed.priority_score >= 40);

    // 3B. Children headcount
    const childrenNeed = calculatePriority({
      need_type: 'shelter',
      people_affected: 5,
      children_count: 3,
      adults_count: 2,
      title: 'Flood shelter blankets needed',
      description: 'Water entering home'
    });
    assert.ok(childrenNeed.vulnerability_factors.includes('3 Children'));
    assert.equal(childrenNeed.breakdown.vulnerability_score, 12); // 3 * 4 = 12

    // 3C. Pregnant woman verified headcount
    const pregnantNeed = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      pregnant_count: 1,
      title: 'Prenatal checkup required',
      description: 'Routine checkup for pregnant woman at camp'
    });
    assert.ok(pregnantNeed.vulnerability_factors.includes('1 Pregnant Woman'));
    assert.ok(pregnantNeed.breakdown.vulnerability_score >= 15);

    // 3D. Multiple pregnant women
    const multiPregnant = calculatePriority({
      need_type: 'medical',
      people_affected: 3,
      pregnant_count: 3,
      title: 'Maternity care at camp',
      description: '3 pregnant women need doctor evaluation'
    });
    assert.ok(multiPregnant.vulnerability_factors.includes('3 Pregnant Women'));
    assert.equal(multiPregnant.breakdown.vulnerability_score, 25); // 20 + 2*2.5 = 25
  });

  await t.test('4. Anti-bias check: Generic mentions of women MUST NOT automatically trigger High priority', () => {
    // Mention of generic women (food request)
    const womanNeed = calculatePriority({
      need_type: 'food',
      people_affected: 2,
      title: 'Dry rations requested',
      description: 'Two adult women and one man need rice and dal packet in camp'
    });
    // Should NOT be life threatening
    assert.equal(womanNeed.is_life_threatening, false);
    // Should NOT have pregnancy factor
    assert.ok(!womanNeed.vulnerability_factors.includes('1 Pregnant Woman'));
    assert.ok(!womanNeed.vulnerability_factors.includes('Pregnancy / Maternity'));
    // Score should be Low or modest Medium, NOT High
    assert.notEqual(womanNeed.priority_level, 'High');
    assert.ok(womanNeed.priority_score < 70, `Expected score < 70 for routine food request, got ${womanNeed.priority_score}`);

    // Bengali word "shombhabona" (probability) MUST NOT trigger pregnancy
    const bengaliRainPossibility = calculatePriority({
      need_type: 'other',
      people_affected: 1,
      title: 'Rain forecast alert',
      description: 'Brishtir shombhabona ache, tarpaulin lagbe' // "Possibility of rain, tarpaulin needed"
    });
    assert.ok(!bengaliRainPossibility.vulnerability_factors.includes('Pregnancy / Maternity'));
    assert.ok(!bengaliRainPossibility.vulnerability_factors.some(f => f.includes('Pregnant')));
  });

  await t.test('5. Medical severity distinction: Acute trauma vs routine medical supplies', () => {
    // 5A. Acute trauma
    const acuteMedical = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      title: 'Severe highway crash',
      description: 'Severe fracture and profuse bleeding, victim is unconscious'
    });
    assert.equal(acuteMedical.priority_level, 'High');
    assert.ok(acuteMedical.priority_score >= 90);

    // 5B. Routine medical aid
    const routineMedical = calculatePriority({
      need_type: 'medical',
      people_affected: 1,
      title: 'Blood pressure medication refill',
      description: 'Elderly person needs regular blood pressure pills delivery'
    });
    assert.equal(routineMedical.is_life_threatening, false);
    // Base 28 + Elderly 10 = 38 (Low/Medium border), NOT High
    assert.notEqual(routineMedical.priority_level, 'High');
    assert.ok(routineMedical.priority_score < 70);
  });

  await t.test('6. Unmet Essential Needs: Starvation & Dehydration Escalation', () => {
    const acuteStarvation = calculatePriority({
      need_type: 'food',
      people_affected: 10,
      title: 'Survivors cut off by flood water',
      description: 'Community has no food for days and severe dehydration, no water to drink',
      is_disaster_zone: true
    });
    assert.ok(acuteStarvation.vulnerability_factors.includes('Acute Water/Food Shortage'));
    assert.ok(acuteStarvation.priority_score >= 45);
    assert.ok(acuteStarvation.vulnerability_factors.includes('Disaster Zone'));
  });

  await t.test('7. Edge Cases: Missing inputs, NaN, negative numbers, and sub-demographic reconciliation', () => {
    // Empty object
    const emptyResult = calculatePriority({});
    assert.ok(emptyResult.priority_score >= 0 && emptyResult.priority_score <= 100);
    assert.ok(emptyResult.urgency_score >= 0 && emptyResult.urgency_score <= 10.0);
    assert.equal(emptyResult.priority_level, 'Low');

    // Negative counts and NaN
    const invalidCounts = calculatePriority({
      need_type: 'food',
      people_affected: 'invalid_NaN',
      children_count: -5,
      adults_count: -10,
      pregnant_count: -2,
    });
    assert.ok(invalidCounts.priority_score >= 0);
    assert.equal(invalidCounts.breakdown.vulnerability_score, 0);

    // Backward compatibility helper
    const scoreVal = calculateScore({ need_type: 'rescue', is_disaster_zone: true });
    assert.equal(typeof scoreVal, 'number');
    assert.ok(scoreVal >= 1.0 && scoreVal <= 10.0);
  });

  await t.test('8. Demographic counts impact: children, adults, pregnant women, and total headcount', () => {
    // 8A. Baseline: 1 adult, food (base 35)
    const baseFood = calculatePriority({
      need_type: 'food',
      people_affected: 1,
      adults_count: 1,
      children_count: 0,
      pregnant_count: 0,
      title: 'Food ration request',
      description: 'Single adult needing food kit'
    });
    // Base 35 + pop(1)=0 = 35 (3.5/10), Low priority
    assert.equal(baseFood.priority_score, 35);
    assert.equal(baseFood.urgency_score, 3.5);
    assert.equal(baseFood.priority_level, 'Low');

    // 8B. Add 2 children to food need:
    // Base 35 + children(2*4=8) + pop(3 people = tier 2-4 = 3) = 46 (4.6/10), Medium priority
    const foodWithChildren = calculatePriority({
      need_type: 'food',
      adults_count: 1,
      children_count: 2,
      pregnant_count: 0,
      title: 'Food ration request',
      description: 'Family needing rations'
    });
    assert.equal(foodWithChildren.priority_score, 46);
    assert.equal(foodWithChildren.urgency_score, 4.6);
    assert.equal(foodWithChildren.priority_level, 'Medium');
    assert.ok(foodWithChildren.vulnerability_factors.includes('2 Children'));

    // 8C. Add 1 pregnant woman to medical need:
    // Base 50 + pregnant(20) + pop(1=0) = 70 (7.0/10), High priority!
    const medicalPregnant = calculatePriority({
      need_type: 'medical',
      pregnant_count: 1,
      children_count: 0,
      adults_count: 1,
      title: 'Maternity medical checkup',
      description: 'Doctor consultation'
    });
    assert.equal(medicalPregnant.priority_score, 70);
    assert.equal(medicalPregnant.urgency_score, 7.0);
    assert.equal(medicalPregnant.priority_level, 'High');
    assert.ok(medicalPregnant.vulnerability_factors.includes('1 Pregnant Woman'));

    // 8D. High headcount impact: 100 people needing shelter
    // Base 30 + pop(100=15) = 45 (4.5/10), Medium priority
    const largeShelter = calculatePriority({
      need_type: 'shelter',
      people_affected: 100,
      title: 'Displaced community shelter',
      description: 'Makeshift camp tarpaulins'
    });
    assert.equal(largeShelter.priority_score, 45);
    assert.equal(largeShelter.urgency_score, 4.5);
    assert.equal(largeShelter.priority_level, 'Medium');
    assert.equal(largeShelter.breakdown.population_score, 15);

    // 8E. Full multi-demographic combination:
    // Medical (50) + 2 Pregnant (20 + 2.5 = 22.5) + 3 Children (3*4 = 12)
    // Vulnerability capped at 30 pts.
    // Total headcount = 5 (2 pregnant + 3 children) -> pop score = 6 pts.
    // Total score = 50 + 30 + 6 = 86 (8.6/10), High priority!
    const complexIncident = calculatePriority({
      need_type: 'medical',
      children_count: 3,
      pregnant_count: 2,
      adults_count: 2,
      title: 'Camp health triage',
      description: 'Multiple vulnerable victims'
    });
    assert.equal(complexIncident.priority_score, 86);
    assert.equal(complexIncident.urgency_score, 8.6);
    assert.equal(complexIncident.priority_level, 'High');
    assert.ok(complexIncident.vulnerability_factors.includes('2 Pregnant Women'));
    assert.ok(complexIncident.vulnerability_factors.includes('3 Children'));
  });
});

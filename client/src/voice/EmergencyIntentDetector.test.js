import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEmergencyIntent } from './EmergencyIntentDetector.js';

test('Target Workflow: Medical emergency with injured headcount', () => {
  const result = evaluateEmergencyIntent("Medical emergency. Five people are injured. Please send help.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'MEDICAL');
  assert.equal(result.facts.peopleCount, 5);
  assert.equal(result.facts.injuredCount, 5);
  assert.ok(result.facts.severitySignals.includes('injury'));
  assert.equal(result.isNegated, false);
});

test('Fire incident classification', () => {
  const result = evaluateEmergencyIntent("Fire in the building. Heavy smoke and flames.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'FIRE');
  assert.equal(result.facts.fire, true);
});

test('Rescue incident with trapped victims', () => {
  const result = evaluateEmergencyIntent("Two people are trapped under debris after wall collapsed.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'RESCUE');
  assert.equal(result.facts.trapped, true);
  assert.equal(result.facts.peopleCount, 2);
});

test('Accident incident with headcounts', () => {
  const result = evaluateEmergencyIntent("Major car accident on the main road. 3 people injured.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'ACCIDENT');
  assert.equal(result.facts.peopleCount, 3);
  assert.equal(result.facts.injuredCount, 3);
});

test('Flood and natural disaster incident', () => {
  const result = evaluateEmergencyIntent("Severe flood in our area. Water is rising rapidly.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'FLOOD');
});

test('Explicit EDC trigger statement', () => {
  const result = evaluateEmergencyIntent("Reporting EDC emergency at ward 4.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'EDC');
});

test('User speaks ONLY EDC', () => {
  const result = evaluateEmergencyIntent("EDC");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'EDC');
});

test('General help request', () => {
  const result = evaluateEmergencyIntent("Please send help immediately, we are in danger.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'HELP');
});

test('Negation check: There is no fire', () => {
  const result = evaluateEmergencyIntent("There is no fire here, false alarm.");
  assert.equal(result.isEmergency, false);
  assert.equal(result.isNegated, true);
});

test('Negation check: Not an emergency / I am safe', () => {
  const result = evaluateEmergencyIntent("I am safe. There is no emergency.");
  assert.equal(result.isEmergency, false);
  assert.equal(result.isNegated, true);
  assert.equal(result.intent, 'SAFE');
});

test('Spoken cancellation in session', () => {
  const result = evaluateEmergencyIntent("Cancel emergency, we are fine.");
  assert.equal(result.isEmergency, false);
  assert.equal(result.intent, 'CANCEL');
});

test('Conversational inquiry is not an emergency', () => {
  const result = evaluateEmergencyIntent("Who are you and what is SevaSetu?");
  assert.equal(result.isEmergency, false);
  assert.equal(result.intent, 'INFO');
});

test('Multilingual demographics parsing: children and pregnant women', () => {
  const result = evaluateEmergencyIntent("One pregnant woman and tin children need medical assistance.");
  assert.equal(result.isEmergency, true);
  assert.equal(result.intent, 'MEDICAL');
  assert.equal(result.facts.pregnantCount, 1);
  assert.equal(result.facts.childrenCount, 3);
});

test('Latency verification: evaluateEmergencyIntent executes in < 5ms', () => {
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    evaluateEmergencyIntent("Medical emergency. Five people are injured near Howrah station.");
  }
  const avg = (performance.now() - start) / 100;
  assert.ok(avg < 5.0, `Average latency was ${avg}ms, expected < 5ms`);
});


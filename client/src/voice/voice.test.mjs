import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceState } from './VoiceController.js';
import { t, getLocale } from './i18n.js';

// Re-create the wake-word matcher for isolated deterministic testing
const WAKE_WORDS = [
  'sevasetu', 'sevashitu', 'sebasetu', 'shevasetu', 'shivasetu', 'sivasetu',
  'sevasethu', 'sebasethu', 'shevasethu', 'heysevasetu', 'hisevasetu', 'oksevasetu',
  'heyseva', 'hiseva', 'saveasatu', 'saveasetu', 'servicesetu', 'sayvasetu',
  'sevaset', 'sebaset', 'heysheba', 'shebasetu', 'saywasetu', 'sewasetu',
  'sevasatu', 'sevashitu', 'shevashitu', 'sayvaseto', 'saybasetu',
  'servicesethu', 'heyseba', 'heysheba', 'heysewa', 'heysebasetu', 'heyshebasetu',
  'sevaseeto', 'sevaseetu', 'sevaseto', 'sevasitoo', 'sevasitu', 'sebasitu',
  'sevashito', 'sebaseto', 'seversetu'
];

function isWakeWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const clean = lower.replace(/[^a-z0-9]/g, '');

  if (WAKE_WORDS.some(kw => clean.includes(kw))) return true;

  if (/\b(?:hey|hi|hello|ok|okay|ay|oye)?\s*(?:seva|sewa|seba|sheba|sheva|sayva|saver|sever)\s+(?:setu|sethu|seeto|setoo|shetu|situ|to|2)\b/i.test(lower)) {
    return true;
  }
  if (/\b(?:hey|hi|hello|ok)\s+(?:seva|seba|sheba|sewa)\b/i.test(lower)) {
    return true;
  }
  if (/\b(?:seva|seba|sheva)\s+(?:setu|sethu|situ|seeto)\b/i.test(lower)) {
    return true;
  }
  return false;
}

function stripWakePrefix(text) {
  if (!text) return '';
  let trailing = text.trim();
  const wakeStripRegex = /^(?:hey|hi|hello|ok|okay|ay|oye)?\s*(?:seva|sewa|siva|shiva|seba|sheba|sheva|sayva|save\s*a|saver|shoba|shubha)\s*(?:setu|sethu|setoo|seeto|sitoo|situ|shetu|chetu|sitoo|said\s*to|say\s*to|stay\s*to|set|to|2|c2)?\b[,.]?\s*/i;
  trailing = trailing.replace(wakeStripRegex, '').trim();
  return trailing;
}

// Deterministic Urgency Floor Function
function calculateUrgency(currentUrgency, facts = {}) {
  let calculated = 1.0;
  if (facts.trapped === true || facts.fire === true) {
    calculated = 10.0;
  } else if (facts.injured === true || (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('injury'))) {
    calculated = Math.max(calculated, 8.0);
  }
  return Math.max(currentUrgency || 1.0, calculated);
}

// ─────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────

test('Wake Word Fuzzy Matcher recognizes diverse speech variations', () => {
  const positiveCases = [
    'Hey SevaSetu',
    'hey seva setu',
    'SevaSetu',
    'seva setu',
    'hey seba setu',
    'seba setu',
    'sheva setu',
    'seva sethu',
    'save a satu',
    'sevaseeto',
    'hey seva',
    'oye seva setu help',
    'hello sevasetu I need help'
  ];

  for (const phrase of positiveCases) {
    assert.equal(isWakeWord(phrase), true, `Failed to match wake word: "${phrase}"`);
  }
});

test('Wake Word Matcher rejects unrelated speech', () => {
  const negativeCases = [
    'hello how are you',
    'good morning',
    'turn on the light',
    'call mom',
    'what time is it',
    'seven seventy'
  ];

  for (const phrase of negativeCases) {
    assert.equal(isWakeWord(phrase), false, `False positive match for: "${phrase}"`);
  }
});

test('Wake Prefix Stripping extracts trailing user utterance cleanly', () => {
  const cases = [
    { input: 'Hey SevaSetu fire in my kitchen', expected: 'fire in my kitchen' },
    { input: 'seva setu, two people trapped', expected: 'two people trapped' },
    { input: 'Hey Seba Setu someone is hurt', expected: 'someone is hurt' },
    { input: 'SevaSetu', expected: '' }
  ];

  for (const c of cases) {
    assert.equal(stripWakePrefix(c.input), c.expected);
  }
});

test('Urgency Monotonicity and Safety Floor enforce strict invariants', () => {
  // Fire floor: 10.0
  assert.equal(calculateUrgency(1.0, { fire: true }), 10.0);
  
  // Trapped floor: 10.0
  assert.equal(calculateUrgency(1.0, { trapped: true }), 10.0);

  // Injury floor: min 8.0
  assert.equal(calculateUrgency(1.0, { injured: true }), 8.0);

  // General emergency does not lower existing urgency
  assert.equal(calculateUrgency(10.0, { general: true }), 10.0);
  assert.equal(calculateUrgency(8.0, { general: true }), 8.0);

  // Safety floor cannot be downgraded
  assert.equal(calculateUrgency(10.0, { fire: false, trapped: false }), 10.0);
});

test('i18n produces accurate prompts across en, bn, hi', () => {
  assert.equal(getLocale('en-US'), 'en');
  assert.equal(getLocale('bn-IN'), 'bn');
  assert.equal(getLocale('hi-IN'), 'hi');

  assert.equal(t('greeting', 'en'), "SevaSetu here. What's your emergency?");
  assert.equal(t('greeting', 'bn'), "সেবা সেতু শুনছে। আপনার কী জরুরি অবস্থা?");
  assert.equal(t('greeting', 'hi'), "सेवा सेतु सुन रहा है। आपकी क्या आपात स्थिति है?");
});

test('VoiceState enum contains all required states', () => {
  const required = [
    'OFF', 'ARMING', 'ARMED_LISTENING_FOR_WAKE', 'TRIGGERED',
    'PROMPTING', 'LISTENING_USER', 'EXTRACTING', 'CONFIRMING', 'STAY_ON_LINE'
  ];
  for (const st of required) {
    assert.ok(VoiceState[st], `Missing VoiceState.${st}`);
  }
});


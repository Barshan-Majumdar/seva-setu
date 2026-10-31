import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceState } from './VoiceController.js';
import { t, getLocale } from './i18n.js';

// Re-create the wake-word matcher for isolated deterministic testing
const WAKE_WORDS = [
  'heysevasetu', 'hisevasetu', 'hellosevasetu', 'oksevasetu', 'oyesevasetu',
  'heyseva', 'hiseva', 'helloseva', 'okseva', 'oyeseva',
  'heyseba', 'hiseba', 'helloseba', 'okseba',
  'heysheba', 'hisheba', 'hellosheba',
  'heysewa', 'hisewa',
  'heysebasetu', 'heyshebasetu', 'heysevasethu', 'heysebasethu', 'heyshevasethu',
  'heysevashitu', 'heysevashito', 'heysevaseeto', 'heysevaseto', 'heysevasitu',
  'heysivasetu', 'heyshivasetu', 'heysabasetu', 'heyshabasetu', 'heyshabhasetu',
  'heyseverity', 'heysevercity', 'heyseversetu', 'heyseversitu', 'heysevenitu', 'heysevensetu',
  'heysaveasatu', 'heysaveasetu', 'heyservicesetu', 'heysayvasetu',
  'sevasetu', 'sebasetu', 'sevasethu', 'sebasethu', 'shevasetu', 'shebasetu',
  'sevashitu', 'sevashito', 'sevaseeto', 'sevaseto', 'sevasitu',
  'sivasetu', 'shivasetu', 'sabasetu', 'shabasetu', 'shabhasetu',
  'saveasatu', 'saveasetu', 'servicesetu', 'sayvasetu'
];

function isWakeWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const clean = lower.replace(/[^a-z0-9]/g, '');

  if (WAKE_WORDS.some(kw => clean.includes(kw))) return true;

  if (/\b(?:hey|hi|hello|ok|okay|ay|oye|eh|he)\s+(?:seva|sewa|seba|sheba|sheva|sayva|saver|sever|seven|service|siva|shiva|sabha|saba|shaba|save\s*a)\s*(?:setu|sethu|seeto|setoo|shetu|situ|city|to|2)?\b/i.test(lower)) {
    return true;
  }
  if (/\b(?:hey|hi|hello|ok|okay|ay|oye|eh|he)\s*(?:sevasetu|sewasetu|sebasetu|shevasetu|severity|severcity|servicesetu|sivasetu|shivasetu)\b/i.test(lower)) {
    return true;
  }
  if (/\b(?:seva|sewa|seba|sheba|sheva|sayva|siva|shiva|sabha|saba|shaba|save\s*a)\s+(?:setu|sethu|seeto|setoo|shetu|situ|city|to|2)\b/i.test(lower)) {
    return true;
  }
  return false;
}

function stripWakePrefix(text) {
  if (!text) return '';
  let trailing = text.trim();
  const wakeStripRegex = /^(?:hey|hi|hello|ok|okay|ay|oye|eh|he)?\s*(?:sevasetu|sewasetu|sebasetu|shevasetu|severity|severcity|servicesetu|sivasetu|shivasetu)?\s*(?:seva|sewa|siva|shiva|seba|sheba|sheva|sayva|save\s*a|saver|sever|seven|service|shoba|shubha)?\s*(?:setu|sethu|setoo|seeto|sitoo|situ|shetu|chetu|city|said\s*to|say\s*to|stay\s*to|set|to|2|c2)?\b[,.]?\s*/i;
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

test('Wake Word Fuzzy Matcher recognizes "Hey SevaSetu", standalone "SevaSetu", and phonetic variations', () => {
  const positiveCases = [
    'Hey SevaSetu',
    'hey seva setu',
    'hey seba setu',
    'hey sheva setu',
    'hey seva sethu',
    'hey siva setu',
    'hey shiva setu',
    'hey save a satu',
    'hey sevaseeto',
    'hey seva',
    'oye seva setu help',
    'hello sevasetu I need help',
    'hi sevasetu',
    'ok sevasetu',
    'hey severity',
    'hey sever setu',
    'hey sever city',
    'hey seven setu',
    'hey save a setu',
    // Standalone brand name trigger (e.g. if mic cuts off leading "hey")
    'sevasetu',
    'seva setu',
    'seba setu',
    'siva setu',
    'shiva setu',
    'seva sethu',
    'sheva setu'
  ];

  for (const phrase of positiveCases) {
    assert.equal(isWakeWord(phrase), true, `Failed to match wake word: "${phrase}"`);
  }
});

test('Wake Word Matcher rejects unrelated speech and standalone dictionary words', () => {
  const negativeCases = [
    'severity',
    'what is the severity of this issue',
    'I was checking severity level',
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
    { input: 'sevasetu fire in my kitchen', expected: 'fire in my kitchen' },
    { input: 'hey seva setu, two people trapped', expected: 'two people trapped' },
    { input: 'Hey Seba Setu someone is hurt', expected: 'someone is hurt' },
    { input: 'hey severity someone fell down', expected: 'someone fell down' },
    { input: 'hey sever setu need ambulance', expected: 'need ambulance' },
    { input: 'hey sever city help me', expected: 'help me' },
    { input: 'Hey SevaSetu', expected: '' },
    { input: 'sevasetu', expected: '' },
    { input: 'hey severity', expected: '' },
    { input: 'hey sever setu', expected: '' }
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

test('VoiceController singleton exposes complete snapshot contract', async () => {
  const { voiceController } = await import('./VoiceController.js');
  const snap = voiceController.getSnapshot();
  assert.ok(typeof snap === 'object');
  assert.ok('state' in snap);
  assert.ok('generation' in snap);
  assert.ok('transcript' in snap);
  assert.ok('partialTranscript' in snap);
  assert.ok('systemReply' in snap);
  assert.ok('isListening' in snap);
  assert.ok('isSpeaking' in snap);
  assert.ok('hasAutoDispatched' in snap);
});

test('VoiceController buffer state resets on session re-arm', async () => {
  const { voiceController } = await import('./VoiceController.js');
  voiceController._hasAutoDispatched = true;
  voiceController._turnAccumulator = 'Old emergency statement';
  
  voiceController.arm();
  
  assert.equal(voiceController._hasAutoDispatched, false);
  assert.equal(voiceController._turnAccumulator, '');
});

test('VoiceController wake-word matcher recognizes phonetics with salutation and brand name', async () => {
  const { voiceController } = await import('./VoiceController.js');
  // Positive with salutation
  assert.equal(voiceController._isWakeWord('hey sevasetu'), true);
  assert.equal(voiceController._isWakeWord('hey severity'), true);
  assert.equal(voiceController._isWakeWord('hey sever setu'), true);
  assert.equal(voiceController._isWakeWord('hi sevasetu'), true);
  assert.equal(voiceController._isWakeWord('hello sevasetu'), true);
  // Standalone brand name
  assert.equal(voiceController._isWakeWord('sevasetu'), true);
  assert.equal(voiceController._isWakeWord('seva setu'), true);
  assert.equal(voiceController._isWakeWord('seba setu'), true);

  // Negative on standalone dictionary words
  assert.equal(voiceController._isWakeWord('severity'), false);
  assert.equal(voiceController._isWakeWord('seven seventy'), false);

  assert.equal(voiceController._stripWakePrefix('hey severity'), '');
  assert.equal(voiceController._stripWakePrefix('hey sevasetu someone broke their leg'), 'someone broke their leg');
  assert.equal(voiceController._stripWakePrefix('sevasetu someone broke their leg'), 'someone broke their leg');
});

test('EmergencyIntentDetector handles conversational connection checks without false dispatch', async () => {
  const { evaluateEmergencyIntent } = await import('./EmergencyIntentDetector.js');

  const check1 = evaluateEmergencyIntent('can you listen me');
  assert.equal(check1.isEmergency, false);
  assert.equal(check1.intent, 'QUERY_DETAILS');

  const check2 = evaluateEmergencyIntent('can you hear me');
  assert.equal(check2.isEmergency, false);
  assert.equal(check2.intent, 'QUERY_DETAILS');

  const check3 = evaluateEmergencyIntent('fire fire trapped inside');
  assert.equal(check3.isEmergency, true);
  assert.equal(check3.intent, 'FIRE');
  assert.equal(check3.facts.fire, true);
  assert.equal(check3.facts.trapped, true);
});

test('VoiceController arm guarantees ARMED_LISTENING_FOR_WAKE state', async () => {
  const { voiceController } = await import('./VoiceController.js');
  voiceController.disarm();
  assert.equal(voiceController.getSnapshot().state, VoiceState.OFF);

  voiceController.arm();
  assert.equal(voiceController.getSnapshot().state, VoiceState.ARMED_LISTENING_FOR_WAKE);
});

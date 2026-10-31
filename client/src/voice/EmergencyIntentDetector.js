/**
 * EmergencyIntentDetector.js
 * High-speed client-side emergency intent classification and fact extraction engine.
 * Evaluates streaming and final speech transcripts in < 10ms without network latency.
 */

const NUMBER_MAP = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'ek': 1, 'do': 2, 'dui': 2, 'teen': 3, 'tin': 3, 'char': 4, 'chaar': 4,
  'panch': 5, 'paanch': 5, 'chhe': 6, 'chhoy': 6, 'saat': 7, 'sat': 7,
  'aath': 8, 'ath': 8, 'nau': 9, 'noy': 9, 'das': 10, 'dosh': 10
};

const NUM_REGEX_STR = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|ek|do|dui|teen|tin|char|chaar|panch|paanch|chhe|chhoy|saat|sat|aath|ath|nau|noy|das|dosh)';

const NEGATION_TOKENS = new Set(['no', 'not', 'dont', "don't", 'never', 'without', 'false', 'neither', 'nor']);

// Category trigger definitions
const TRIGGERS = {
  FIRE: ['fire', 'burning', 'smoke', 'flames', 'ablaze', 'house fire', 'cylinder blast', 'aag', 'agun', 'jalche'],
  MEDICAL: [
    'medical', 'injured', 'injury', 'injuries', 'hurt', 'bleeding', 'blood', 'wound', 'wounds',
    'heart attack', 'chest pain', 'unconscious', 'stroke', 'ambulance', 'hospital', 'doctor',
    'ghayal', 'rokto', 'chot', 'oshustho', 'seizure', 'casualties', 'casualty'
  ],
  RESCUE: [
    'rescue', 'trapped', 'stuck', 'buried', 'collapsed', 'under debris',
    'building collapse', 'wall fell', 'locked inside', 'fas gaya', 'aatke', 'atke'
  ],
  ACCIDENT: [
    'accident', 'crash', 'collision', 'car crash', 'road accident',
    'vehicle accident', 'hit and run', 'durghatna', 'durghotona'
  ],
  FLOOD: [
    'flood', 'flooding', 'drowning', 'drowned', 'underwater', 'water rising',
    'cyclone', 'storm', 'hurricane', 'tsunami', 'landslide', 'baadh', 'bonna'
  ],
  EDC: ['edc', 'e.d.c.', 'e d c'],
  HELP: [
    'help', 'send help', 'help me', 'please help', 'need assistance',
    'emergency', 'bachao', 'sahayata', 'banchao'
  ]
};

function parseNumber(str) {
  if (!str) return null;
  const s = str.toLowerCase().trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return NUMBER_MAP[s] || null;
}

/**
 * Checks if target trigger words are immediately preceded by negation in a 3-word window
 */
function isTriggerNegated(targetWords, text) {
  for (const tw of targetWords) {
    const regex = new RegExp(`\\b${tw.replace(/\./g, '\\.')}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const prefix = text.substring(0, match.index).trim();
      const prefixWords = prefix.match(/\b[\w']+\b/g) || [];
      const windowWords = prefixWords.slice(-3);
      if (windowWords.some(w => NEGATION_TOKENS.has(w.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Evaluates a spoken transcript for emergency intent, headcounts, and negation.
 * @param {string} transcript - Speech text to evaluate
 * @returns {object} Classification result
 */
export function evaluateEmergencyIntent(transcript) {
  const clean = (transcript || '').trim();
  if (!clean) {
    return {
      isEmergency: false,
      intent: 'UNKNOWN',
      isNegated: false,
      facts: createEmptyFacts(),
      confidence: 0.0
    };
  }

  const lower = clean.toLowerCase();

  // 1. Direct safety / cancellation checks
  const safePhrases = [
    'i am safe', 'i am fine', 'i am okay', 'no emergency', 'false alarm',
    'everything is fine', 'all good', 'we are safe', 'we are fine',
    'there is no emergency', 'actually no emergency', 'not in danger',
    'do not need help', 'dont need help', 'cancel emergency', 'cancel'
  ];
  if (safePhrases.some(p => lower.includes(p))) {
    return {
      isEmergency: false,
      intent: lower.includes('cancel') ? 'CANCEL' : 'SAFE',
      isNegated: true,
      facts: createEmptyFacts(),
      confidence: 0.99
    };
  }

  // 2. Direct info / conversational inquiry check
  const infoPhrases = ['who are you', 'what are you', 'what is sevasetu', 'what is seva setu', 'introduce yourself'];
  if (infoPhrases.some(p => lower.includes(p))) {
    return {
      isEmergency: false,
      intent: 'INFO',
      isNegated: false,
      facts: createEmptyFacts(),
      confidence: 0.99,
      reply: 'I am Seva Setu, your disaster and emergency relief assistant. Is there an emergency right now?'
    };
  }

  // 3. Conversational connection check ("can you hear me", "can you listen me", "are you listening")
  const connectionPhrases = [
    'can you hear me', 'can you hear', 'can you listen to me', 'can you listen me',
    'are you listening', 'are you hearing me', 'listen to me', 'can you understand me',
    'hello', 'hi'
  ];
  if (connectionPhrases.some(p => lower.includes(p))) {
    const hasEmergencyKeyword = ['fire', 'injured', 'hurt', 'trapped', 'flood', 'accident', 'edc', 'help', 'ambulance', 'bleeding'].some(w => lower.includes(w));
    if (!hasEmergencyKeyword) {
      return {
        isEmergency: false,
        intent: 'QUERY_DETAILS',
        isNegated: false,
        facts: createEmptyFacts(),
        confidence: 0.95,
        reply: "Yes, I can hear you clearly! Please describe what is happening."
      };
    }
  }

  // 4. Demographic parsing
  const facts = createEmptyFacts();

  const childMatch = lower.match(new RegExp(`${NUM_REGEX_STR}\\s*(?:children|child|kids|kid|babies|baby|infants|infant|minors|minor|bacche|baccha|sishu)`, 'i'));
  if (childMatch) facts.childrenCount = parseNumber(childMatch[1]);

  const womenMatch = lower.match(new RegExp(`${NUM_REGEX_STR}\\s*(?:women|woman|ladies|lady|female|females|mahila|mohila|aurat)`, 'i'));
  if (womenMatch) facts.womenCount = parseNumber(womenMatch[1]);

  const pregMatch = lower.match(new RegExp(`${NUM_REGEX_STR}?\\s*(?:pregnant|expecting mother|garbhvati|garbhavati|prasuti)`, 'i'));
  if (pregMatch) {
    facts.pregnantCount = parseNumber(pregMatch[1]) || 1;
  } else if (/\b(pregnant|garbhvati|prasuti)\b/i.test(lower)) {
    facts.pregnantCount = 1;
  }

  const injuredMatch = lower.match(new RegExp(`${NUM_REGEX_STR}\\s*(?:people\\s+are\\s+injured|people\\s+injured|injured|hurt|wounded|bleeding|casualties|ghayal|rokto)`, 'i'));
  if (injuredMatch) facts.injuredCount = parseNumber(injuredMatch[1]);

  const peopleMatch = lower.match(new RegExp(`${NUM_REGEX_STR}\\s*(?:people|persons|victims|casualties|manush|jon|log|vyakti)`, 'i'));
  if (peopleMatch) {
    facts.peopleCount = parseNumber(peopleMatch[1]);
  } else if (facts.injuredCount) {
    facts.peopleCount = facts.injuredCount;
  } else if (facts.womenCount || facts.childrenCount) {
    facts.peopleCount = (facts.womenCount || 0) + (facts.childrenCount || 0);
  }

  // 4. Intent Categorization & Negation Filtering
  let detectedIntent = null;
  let hasNegation = false;

  // Check categories in priority order
  // Priority: Accident > Fire > Rescue > Medical > Flood > EDC > Help
  const checkCategory = (categoryKey, triggers) => {
    const matches = triggers.some(t => {
      if (t === 'edc' || t === 'e.d.c.' || t === 'e d c') {
        return new RegExp(`\\b${t.replace(/\./g, '\\.')}\\b`, 'i').test(lower) || lower.trim() === t;
      }
      return new RegExp(`\\b${t}\\b`, 'i').test(lower);
    });

    if (matches) {
      if (isTriggerNegated(triggers, lower)) {
        hasNegation = true;
        return false;
      }
      return true;
    }
    return false;
  };

  const hasAccident = checkCategory('ACCIDENT', TRIGGERS.ACCIDENT);
  const hasFire = checkCategory('FIRE', TRIGGERS.FIRE);
  const hasRescue = checkCategory('RESCUE', TRIGGERS.RESCUE);
  const hasMedical = checkCategory('MEDICAL', TRIGGERS.MEDICAL);
  const hasFlood = checkCategory('FLOOD', TRIGGERS.FLOOD);
  const hasEdc = checkCategory('EDC', TRIGGERS.EDC);
  const hasHelp = checkCategory('HELP', TRIGGERS.HELP);

  if (hasFire) {
    facts.fire = true;
    facts.severitySignals.push('fire');
  }
  if (hasRescue) {
    facts.trapped = true;
    facts.severitySignals.push('trapped');
  }
  if (hasMedical || (facts.injuredCount && facts.injuredCount > 0)) {
    facts.severitySignals.push('injury');
  }
  if (hasAccident) {
    facts.severitySignals.push('accident');
  }
  if (hasFlood) {
    facts.severitySignals.push('flood');
  }
  if (hasEdc) {
    facts.severitySignals.push('edc');
  }
  if (hasHelp) {
    facts.severitySignals.push('help');
  }

  // Determine Primary Intent by Strict Priority:
  // ACCIDENT > FIRE > RESCUE > MEDICAL > FLOOD > EDC > HELP
  if (hasAccident) {
    detectedIntent = 'ACCIDENT';
  } else if (hasFire) {
    detectedIntent = 'FIRE';
  } else if (hasRescue) {
    detectedIntent = 'RESCUE';
  } else if (hasMedical || (facts.injuredCount && facts.injuredCount > 0)) {
    detectedIntent = 'MEDICAL';
  } else if (hasFlood) {
    detectedIntent = 'FLOOD';
  } else if (hasEdc) {
    detectedIntent = 'EDC';
  } else if (hasHelp) {
    detectedIntent = 'HELP';
  }

  // Also check if injuredCount was set even if no other medical word triggered
  if (!detectedIntent && facts.injuredCount && facts.injuredCount > 0) {
    detectedIntent = 'MEDICAL';
    facts.severitySignals.push('injury');
  }

  const isEmergency = Boolean(detectedIntent) && !hasNegation;
  const emergencyMessage = "We have received your distress signal. You are not alone. Assistance is being coordinated.";

  return {
    isEmergency,
    intent: detectedIntent || (hasNegation ? 'SAFE' : 'UNKNOWN'),
    isNegated: hasNegation,
    facts,
    confidence: isEmergency ? 0.95 : 0.5,
    reply: isEmergency ? emergencyMessage : (hasNegation ? 'Understood.' : 'I am listening. Please describe your emergency or let me know what assistance you need.')
  };
}

function createEmptyFacts() {
  return {
    peopleCount: null,
    injuredCount: null,
    childrenCount: null,
    womenCount: null,
    pregnantCount: null,
    trapped: false,
    fire: false,
    severitySignals: []
  };
}

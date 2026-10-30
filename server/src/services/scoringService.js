/**
 * Smart Emergency Priority & Vulnerability Scoring Service (SevaSetu EPI 0-100)
 * Evaluates demographic vulnerabilities, life-threatening hazards, acute medical severity,
 * population scale, and disaster context to calculate:
 * - priority_score (0-100)
 * - urgency_score (0.0-10.0 normalized for backward compatibility)
 * - priority_level ('High' | 'Medium' | 'Low')
 * - is_life_threatening (boolean)
 * - vulnerability_factors (human-readable string[])
 * - breakdown (detailed component scores for auditability)
 */

// ── Configurable Weights & Thresholds ──────────────────────────────────────────
const SCORING_CONFIG = {
  // Base weights by incident category (0 to 50)
  CATEGORY_BASE: {
    medical: 50,
    rescue: 50,
    accidental: 45,
    food: 35,
    shelter: 30,
    other: 20,
    education: 15,
  },

  // Immediate Life Threat Escalation Floor
  LIFE_THREAT_MIN_SCORE: 90,

  // Priority Classification Thresholds
  THRESHOLDS: {
    HIGH: 70,    // Score >= 70 OR is_life_threatening -> High
    MEDIUM: 40,  // 40 <= Score < 70 -> Medium
                 // Score < 40 -> Low
  },

  // Demographic Vulnerability Weights (0 to 30 cap)
  VULNERABILITY: {
    pregnancy_base: 20,
    pregnancy_per_additional: 2.5,
    pregnancy_max: 25,
    infant: 20,
    children_per_child: 4,
    children_max: 16,
    children_keyword_fallback: 10,
    elderly_or_disabled: 12,
    max_total: 30,
  },

  // Hazard and Severity Weights (0 to 25 cap)
  SEVERITY: {
    trapped_collapse: 25,
    active_fire: 25,
    critical_medical: 25,
    severe_dehydration_starvation: 18,
    moderate_injury: 14,
    contaminated_water_epidemic: 12,
    exposure_hypothermia: 12,
    flood_waterlogging: 10,
    max_total: 25,
  },

  // Population Scale Cap (0 to 15)
  POPULATION_MAX: 15,

  // Contextual Modifiers
  CONTEXT: {
    disaster_zone: 8,
    verified: 5,
  }
};

// ── Regex Pattern Library (Multilingual: EN, HI, BN) ───────────────────────────
const PATTERNS = {
  // Immediate Life Threats
  lifeThreat: {
    trapped: /\b(trapped|buried|under debris|under rubble|collapsed building|debris collapse|landslide|cave[- ]?in|aatke ache|dab gaya|phas gaya|malbe me)\b/i,
    activeFire: /\b(active fire|burning building|massive fire|explosion|cylinder blast|flames spreading|aagun|aag lag gayi|aglaag)\b/i,
    criticalMedical: /\b(cardiac arrest|heart attack|unconscious|unresponsive|not breathing|suffocation|severe bleeding|arterial bleed|profuse bleeding|hemorrhage|head trauma|amputation|electrocution|drowning|drowned|rokto porche|behosh|rokter dhol)\b/i,
    deliveryEmergency: /\b(active labor|active labour|delivery in progress|imminent childbirth|prashav vedna|prasav peeda|proshob)\b/i,
  },

  // Acute Hazard & Medical Severity Signals
  severity: {
    moderateInjury: /\b(injur|wound|fracture|broken bone|deep cut|burns|burn injury|ghayal|chot|khoto|bhange geche)\b/i,
    acuteStarvationDehydration: /\b(no food for days|starving|starvation|dehydrated|dehydration|no water to drink|pani nahi hai|jol nei|khabar nei koyek din)\b/i,
    contaminatedWater: /\b(contaminated water|waterborne|cholera|diarrhea|dysentery|toxic water|dushito jol|ganda pani)\b/i,
    exposure: /\b(hypothermia|freezing|heat stroke|shivering|no blanket in cold|extreme cold|thanda te jamche|sardi lag gayi)\b/i,
    floodWater: /\b(waterlogged|water level rising|submerged|flooded|banya|pani bhar gaya|jol bheshe geche)\b/i,
  },

  // Vulnerable Demographics
  vulnerability: {
    // Pregnancy: Must be specific to pregnancy/maternity (NOT generic women/female)
    pregnancy: /\b(pregnan[a-z]*|expecting mother[s]?|maternity|prenatal|postnatal|garbhvati|garbhavati|pettik|prashav|prasuti|garbha)\b/i,
    infant: /\b(infant[s]?|newborn[s]?|baby|babies|toddler[s]?|navjat|nabajat|shishu|sishu|dudhposho|choto bachha|chotobacha)\b/i,
    // Children: Specific to minors/kids (avoids false positive on adjective 'minor')
    children: /\b(child|children|kid[s]?|minors|minor child|underage|bacche|baccha|chhotoder)\b/i,
    // Elderly & Disabled
    elderlyOrDisabled: /\b(elderly|senior[s]?|senior citizen[s]?|old age|aged|grandma|grandpa|biddho|briddha|bujurg|disabled|handicapped|bedridden|paralyzed|differently abled|apahij|protibondhi)\b/i,
  }
};

/**
 * Calculate population score using tiered logarithmic curve
 * Ensures smooth scaling up to 1000+ people without drowning individual critical emergencies.
 * @param {number} totalPeople
 * @returns {number} Score from 0 to 15
 */
const calculatePopulationScore = (totalPeople = 1) => {
  const count = Math.max(1, parseInt(totalPeople, 10) || 1);
  if (count <= 1) return 0;
  if (count <= 4) return 3;
  if (count <= 10) return 6;
  if (count <= 25) return 9;
  if (count <= 50) return 12;
  // Tiered logarithmic growth for 51+
  const logScore = Math.min(SCORING_CONFIG.POPULATION_MAX, Math.round(3.5 * Math.log(count)));
  return Math.max(12, logScore);
};

/**
 * Analyze text & demographic inputs for vulnerabilities, hazard signals, and life threats
 * @param {string} text - Title and description combined
 * @param {number} childrenCount - Headcount of children
 * @param {number} pregnantCount - Headcount of pregnant women
 * @returns {Object} Comprehensive analysis
 */
const analyzeVulnerability = (text = '', childrenCount = 0, pregnantCount = 0) => {
  const combined = String(text || '').trim();
  const factors = [];

  let vulnScore = 0;
  let severityScore = 0;
  let isLifeThreatening = false;
  let lifeThreatReasons = [];

  const numPregnant = Math.max(0, parseInt(pregnantCount, 10) || 0);
  const numChildren = Math.max(0, parseInt(childrenCount, 10) || 0);

  // ── 1. Immediate Life Threat Detection ─────────────────────────────────────
  if (PATTERNS.lifeThreat.trapped.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('People Trapped / Rubble Collapse');
    factors.push('🚨 Critical: Trapped / Debris');
    severityScore += SCORING_CONFIG.SEVERITY.trapped_collapse;
  }

  if (PATTERNS.lifeThreat.activeFire.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('Active Fire / Explosion');
    factors.push('🚨 Critical: Active Fire');
    severityScore += SCORING_CONFIG.SEVERITY.active_fire;
  }

  if (PATTERNS.lifeThreat.criticalMedical.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('Critical Medical Emergency');
    factors.push('🚨 Critical: Severe Trauma / Bleeding');
    severityScore += SCORING_CONFIG.SEVERITY.critical_medical;
  }

  if (PATTERNS.lifeThreat.deliveryEmergency.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('Active Labor / Emergency Delivery');
    factors.push('🚨 Critical: Imminent Delivery');
    severityScore += SCORING_CONFIG.SEVERITY.critical_medical;
  }

  // ── 2. Acute Hazard & Severity Signals (if not already saturated) ───────────
  if (PATTERNS.severity.moderateInjury.test(combined) && !isLifeThreatening) {
    factors.push('Injuries Reported');
    severityScore += SCORING_CONFIG.SEVERITY.moderate_injury;
  }

  if (PATTERNS.severity.acuteStarvationDehydration.test(combined)) {
    factors.push('Acute Water/Food Shortage');
    severityScore += SCORING_CONFIG.SEVERITY.severe_dehydration_starvation;
  }

  if (PATTERNS.severity.contaminatedWater.test(combined)) {
    factors.push('Contaminated Water / Disease Risk');
    severityScore += SCORING_CONFIG.SEVERITY.contaminated_water_epidemic;
  }

  if (PATTERNS.severity.exposure.test(combined)) {
    factors.push('Exposure / Hypothermia Risk');
    severityScore += SCORING_CONFIG.SEVERITY.exposure_hypothermia;
  }

  if (PATTERNS.severity.floodWater.test(combined)) {
    factors.push('Rising Water / Flooding');
    severityScore += SCORING_CONFIG.SEVERITY.flood_waterlogging;
  }

  severityScore = Math.min(SCORING_CONFIG.SEVERITY.max_total, severityScore);

  // ── 3. Demographic Vulnerabilities ─────────────────────────────────────────
  // Pregnancy / Maternity (Excludes generic women keywords)
  const hasPregnancyText = PATTERNS.vulnerability.pregnancy.test(combined);
  const hasPregnancy = numPregnant > 0 || hasPregnancyText;
  if (hasPregnancy) {
    const label = numPregnant > 1
      ? `${numPregnant} Pregnant Women`
      : (numPregnant === 1 ? '1 Pregnant Woman' : 'Pregnancy / Maternity');
    factors.push(label);
    const pregBonus = SCORING_CONFIG.VULNERABILITY.pregnancy_base +
      (numPregnant > 1 ? Math.min(5, (numPregnant - 1) * SCORING_CONFIG.VULNERABILITY.pregnancy_per_additional) : 0);
    vulnScore += pregBonus;
  }

  // Infants & Newborns
  const hasInfant = PATTERNS.vulnerability.infant.test(combined);
  if (hasInfant) {
    factors.push('Infants / Newborns');
    vulnScore += SCORING_CONFIG.VULNERABILITY.infant;
  }

  // Children Headcount & Verified Keywords
  const hasChildrenKeywords = PATTERNS.vulnerability.children.test(combined);
  if (numChildren > 0) {
    factors.push(`${numChildren} ${numChildren === 1 ? 'Child' : 'Children'}`);
    vulnScore += Math.min(SCORING_CONFIG.VULNERABILITY.children_max, numChildren * SCORING_CONFIG.VULNERABILITY.children_per_child);
  } else if (hasChildrenKeywords && !hasInfant) {
    factors.push('Children Involved');
    vulnScore += SCORING_CONFIG.VULNERABILITY.children_keyword_fallback;
  }

  // Elderly & Disabled
  const hasElderlyOrDisabled = PATTERNS.vulnerability.elderlyOrDisabled.test(combined);
  if (hasElderlyOrDisabled) {
    factors.push('Elderly / Disabled');
    vulnScore += SCORING_CONFIG.VULNERABILITY.elderly_or_disabled;
  }

  vulnScore = Math.min(SCORING_CONFIG.VULNERABILITY.max_total, vulnScore);

  return {
    factors: Array.from(new Set(factors)),
    vulnScore,
    severityScore,
    isLifeThreatening,
    lifeThreatReasons,
    hasPregnancy,
    hasInfant,
    hasChildren: numChildren > 0 || hasChildrenKeywords,
    hasElderlyOrDisabled,
    childrenCount: numChildren,
    pregnantCount: numPregnant
  };
};

/**
 * Calculate request priority and urgency score based on transparent 0-100 model
 * @param {Object} need - Need data object
 * @returns {Object} Comprehensive calculation result
 */
const calculatePriority = (need = {}) => {
  const {
    need_type = 'other',
    needType,
    people_affected = 0,
    peopleAffected,
    children_count = 0,
    childrenCount,
    adults_count = 0,
    adultsCount,
    pregnant_count = 0,
    pregnantCount,
    title = '',
    description = '',
    is_disaster_zone = false,
    isDisasterZone,
    is_verified = false,
    isVerified
  } = need;

  const type = String(need_type || needType || 'other').toLowerCase();
  const children = Math.max(0, parseInt(children_count ?? childrenCount ?? 0, 10) || 0);
  const adults = Math.max(0, parseInt(adults_count ?? adultsCount ?? 0, 10) || 0);
  const pregnant = Math.max(0, parseInt(pregnant_count ?? pregnantCount ?? 0, 10) || 0);
  const effectiveAdults = Math.max(adults, pregnant);

  const rawPeople = parseInt(people_affected ?? peopleAffected ?? 0, 10);
  const minHeadcount = children + effectiveAdults;
  const totalPeople = (!isNaN(rawPeople) && rawPeople >= minHeadcount)
    ? rawPeople
    : Math.max(1, minHeadcount);

  const inDisasterZone = Boolean(is_disaster_zone || isDisasterZone);
  const verified = Boolean(is_verified || isVerified);

  // 1. Analyze text & vulnerabilities
  const combinedText = `${title || ''} ${description || ''}`;
  const analysis = analyzeVulnerability(combinedText, children, pregnant);

  // 2. Base Category Score (0 to 30)
  const baseScore = SCORING_CONFIG.CATEGORY_BASE[type] || SCORING_CONFIG.CATEGORY_BASE.other;

  // 3. Severity Score (0 to 25)
  const severityScore = analysis.severityScore;

  // 4. Vulnerability Score (0 to 25)
  const vulnerabilityScore = analysis.vulnScore;

  // 5. Population Score (0 to 15)
  const populationScore = calculatePopulationScore(totalPeople);

  // 6. Context Modifiers (Disaster Zone + Verified)
  const disasterModifier = inDisasterZone ? SCORING_CONFIG.CONTEXT.disaster_zone : 0;
  const verifiedModifier = verified ? SCORING_CONFIG.CONTEXT.verified : 0;
  const contextScore = disasterModifier + verifiedModifier;

  // 7. Composite 0-100 Calculation
  let rawScore = baseScore + severityScore + vulnerabilityScore + populationScore + contextScore;

  // 8. Immediate Life Threat Override Floor (Mandatory Escalation)
  let lifeThreatApplied = false;
  if (analysis.isLifeThreatening) {
    if (rawScore < SCORING_CONFIG.LIFE_THREAT_MIN_SCORE) {
      rawScore = SCORING_CONFIG.LIFE_THREAT_MIN_SCORE;
      lifeThreatApplied = true;
    }
  }

  // Clamped 0 to 100 integer score
  const priority_score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Normalized 1.0 to 10.0 score for backward compatibility
  const urgency_score = parseFloat((priority_score / 10).toFixed(1));

  // 9. Priority Level Classification
  let priority_level = 'Low';
  if (analysis.isLifeThreatening || priority_score >= SCORING_CONFIG.THRESHOLDS.HIGH) {
    priority_level = 'High';
  } else if (priority_score >= SCORING_CONFIG.THRESHOLDS.MEDIUM) {
    priority_level = 'Medium';
  } else {
    priority_level = 'Low';
  }

  // Append Disaster Zone badge if active
  const factors = [...analysis.factors];
  if (inDisasterZone && !factors.includes('Disaster Zone')) {
    factors.push('Disaster Zone');
  }

  return {
    priority_score,
    urgency_score,
    priority_level,
    is_life_threatening: analysis.isLifeThreatening,
    life_threat_reasons: analysis.lifeThreatReasons,
    vulnerability_factors: factors,
    breakdown: {
      base_score: baseScore,
      severity_score: severityScore,
      vulnerability_score: vulnerabilityScore,
      population_score: populationScore,
      context_score: contextScore,
      life_threat_applied: lifeThreatApplied
    }
  };
};

/**
 * Backward compatible score calculator (returns normalized 1-10 float)
 */
const calculateScore = (need) => {
  return calculatePriority(need).urgency_score;
};

module.exports = {
  SCORING_CONFIG,
  calculateScore,
  calculatePriority,
  analyzeVulnerability,
  calculatePopulationScore,
  PATTERNS
};

/**
 * Client-Side Smart Emergency Priority & Urgency Preview Calculator (SevaSetu EPI 0-100)
 * Evaluates demographic vulnerabilities, life-threatening hazards, acute medical severity,
 * population scale, and disaster context to predict:
 * - score (0-100)
 * - score10 (0.0-10.0 normalized)
 * - priority ('High' | 'Medium' | 'Low')
 * - isLifeThreatening (boolean)
 * - factors (human-readable string[])
 * - breakdown (transparent component scores)
 */

export const SCORING_CONFIG = {
  CATEGORY_BASE: {
    medical: 50,
    rescue: 50,
    accidental: 45,
    food: 35,
    shelter: 30,
    other: 20,
    education: 15,
  },
  LIFE_THREAT_MIN_SCORE: 90,
  THRESHOLDS: {
    HIGH: 70,
    MEDIUM: 40,
  },
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
  POPULATION_MAX: 15,
  CONTEXT: {
    disaster_zone: 8,
    verified: 5,
  }
};

const PATTERNS = {
  lifeThreat: {
    trapped: /\b(trapped|buried|under debris|under rubble|collapsed building|debris collapse|landslide|cave[- ]?in|aatke ache|dab gaya|phas gaya|malbe me)\b/i,
    activeFire: /\b(active fire|burning building|massive fire|explosion|cylinder blast|flames spreading|aagun|aag lag gayi|aglaag)\b/i,
    criticalMedical: /\b(cardiac arrest|heart attack|unconscious|unresponsive|not breathing|suffocation|severe bleeding|arterial bleed|profuse bleeding|hemorrhage|head trauma|amputation|electrocution|drowning|drowned|rokto porche|behosh|rokter dhol)\b/i,
    deliveryEmergency: /\b(active labor|active labour|delivery in progress|imminent childbirth|prashav vedna|prasav peeda|proshob)\b/i,
  },
  severity: {
    moderateInjury: /\b(injur|wound|fracture|broken bone|deep cut|burns|burn injury|ghayal|chot|khoto|bhange geche)\b/i,
    acuteStarvationDehydration: /\b(no food for days|starving|starvation|dehydrated|dehydration|no water to drink|pani nahi hai|jol nei|khabar nei koyek din)\b/i,
    contaminatedWater: /\b(contaminated water|waterborne|cholera|diarrhea|dysentery|toxic water|dushito jol|ganda pani)\b/i,
    exposure: /\b(hypothermia|freezing|heat stroke|shivering|no blanket in cold|extreme cold|thanda te jamche|sardi lag gayi)\b/i,
    floodWater: /\b(waterlogged|water level rising|submerged|flooded|banya|pani bhar gaya|jol bheshe geche)\b/i,
  },
  vulnerability: {
    pregnancy: /\b(pregnan[a-z]*|expecting mother[s]?|maternity|prenatal|postnatal|garbhvati|garbhavati|pettik|prashav|prasuti|garbha)\b/i,
    infant: /\b(infant[s]?|newborn[s]?|baby|babies|toddler[s]?|navjat|nabajat|shishu|sishu|dudhposho|choto bachha|chotobacha)\b/i,
    // Children: Specific to minors/kids (avoids false positive on adjective 'minor')
    children: /\b(child|children|kid[s]?|minors|minor child|underage|bacche|baccha|chhotoder)\b/i,
    elderlyOrDisabled: /\b(elderly|senior[s]?|senior citizen[s]?|old age|aged|grandma|grandpa|biddho|briddha|bujurg|disabled|handicapped|bedridden|paralyzed|differently abled|apahij|protibondhi)\b/i,
  }
};

const calculatePopulationScore = (totalPeople = 1) => {
  const count = Math.max(1, parseInt(totalPeople, 10) || 1);
  if (count <= 1) return 0;
  if (count <= 4) return 3;
  if (count <= 10) return 6;
  if (count <= 25) return 9;
  if (count <= 50) return 12;
  const logScore = Math.min(SCORING_CONFIG.POPULATION_MAX, Math.round(3.5 * Math.log(count)));
  return Math.max(12, logScore);
};

export const calculateUrgencyPreview = ({
  need_type = 'medical',
  people_affected = 0,
  children_count = 0,
  adults_count = 0,
  pregnant_count = 0,
  title = '',
  description = '',
  is_disaster_zone = false,
}) => {
  const combined = `${title || ''} ${description || ''}`.trim();
  const factors = [];

  let vulnScore = 0;
  let severityScore = 0;
  let isLifeThreatening = false;
  let lifeThreatReasons = [];

  const numPregnant = Math.max(0, parseInt(pregnant_count, 10) || 0);
  const numChildren = Math.max(0, parseInt(children_count, 10) || 0);
  const numAdults = Math.max(0, parseInt(adults_count, 10) || 0);
  const effectiveAdults = Math.max(numAdults, numPregnant);

  const rawPeople = parseInt(people_affected, 10);
  const minHeadcount = numChildren + effectiveAdults;
  const totalCount = (!isNaN(rawPeople) && rawPeople >= minHeadcount)
    ? rawPeople
    : Math.max(1, minHeadcount);

  // 1. Life Threat Detection
  if (PATTERNS.lifeThreat.trapped.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('Trapped Under Rubble / Debris');
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
    lifeThreatReasons.push('Severe Trauma / Unconscious');
    factors.push('🚨 Critical: Severe Trauma / Bleeding');
    severityScore += SCORING_CONFIG.SEVERITY.critical_medical;
  }
  if (PATTERNS.lifeThreat.deliveryEmergency.test(combined)) {
    isLifeThreatening = true;
    lifeThreatReasons.push('Imminent Childbirth / Labor');
    factors.push('🚨 Critical: Imminent Delivery');
    severityScore += SCORING_CONFIG.SEVERITY.critical_medical;
  }

  // 2. Hazard & Severity Signals
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

  // 3. Demographic Vulnerabilities
  const hasPregnancy = numPregnant > 0 || PATTERNS.vulnerability.pregnancy.test(combined);
  if (hasPregnancy) {
    const label = numPregnant > 1
      ? `${numPregnant} Pregnant Women`
      : (numPregnant === 1 ? '1 Pregnant Woman' : 'Pregnancy / Maternity');
    factors.push(label);
    const pregBonus = SCORING_CONFIG.VULNERABILITY.pregnancy_base +
      (numPregnant > 1 ? Math.min(5, (numPregnant - 1) * SCORING_CONFIG.VULNERABILITY.pregnancy_per_additional) : 0);
    vulnScore += pregBonus;
  }

  const hasInfant = PATTERNS.vulnerability.infant.test(combined);
  if (hasInfant) {
    factors.push('Infants / Newborns');
    vulnScore += SCORING_CONFIG.VULNERABILITY.infant;
  }

  const hasChildrenKeywords = PATTERNS.vulnerability.children.test(combined);
  if (numChildren > 0) {
    factors.push(`${numChildren} ${numChildren === 1 ? 'Child' : 'Children'}`);
    vulnScore += Math.min(SCORING_CONFIG.VULNERABILITY.children_max, numChildren * SCORING_CONFIG.VULNERABILITY.children_per_child);
  } else if (hasChildrenKeywords && !hasInfant) {
    factors.push('Children Involved');
    vulnScore += SCORING_CONFIG.VULNERABILITY.children_keyword_fallback;
  }

  const hasElderly = PATTERNS.vulnerability.elderlyOrDisabled.test(combined);
  if (hasElderly) {
    factors.push('Elderly / Disabled');
    vulnScore += SCORING_CONFIG.VULNERABILITY.elderly_or_disabled;
  }

  vulnScore = Math.min(SCORING_CONFIG.VULNERABILITY.max_total, vulnScore);

  // 4. Base & Population
  const baseScore = SCORING_CONFIG.CATEGORY_BASE[need_type] || SCORING_CONFIG.CATEGORY_BASE.other;
  const populationScore = calculatePopulationScore(totalCount);
  const disasterScore = is_disaster_zone ? SCORING_CONFIG.CONTEXT.disaster_zone : 0;

  // 5. Composite Score
  let rawScore = baseScore + severityScore + vulnScore + populationScore + disasterScore;
  let lifeThreatApplied = false;
  if (isLifeThreatening && rawScore < SCORING_CONFIG.LIFE_THREAT_MIN_SCORE) {
    rawScore = SCORING_CONFIG.LIFE_THREAT_MIN_SCORE;
    lifeThreatApplied = true;
  }

  const score100 = Math.min(100, Math.max(0, Math.round(rawScore)));
  const score10 = parseFloat((score100 / 10).toFixed(1));

  // 6. Priority Level
  let priority = 'Low';
  if (isLifeThreatening || score100 >= SCORING_CONFIG.THRESHOLDS.HIGH) {
    priority = 'High';
  } else if (score100 >= SCORING_CONFIG.THRESHOLDS.MEDIUM) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  if (is_disaster_zone && !factors.includes('Disaster Zone')) {
    factors.push('Disaster Zone');
  }

  return {
    score: score100,
    score100,
    score10,
    priority,
    isLifeThreatening,
    lifeThreatReasons,
    factors: Array.from(new Set(factors)),
    breakdown: {
      base_score: baseScore,
      severity_score: severityScore,
      vulnerability_score: vulnScore,
      population_score: populationScore,
      disaster_score: disasterScore,
      life_threat_applied: lifeThreatApplied
    },
    valueOf() { return score100; },
    toString() { return String(score100); }
  };
};

export default calculateUrgencyPreview;

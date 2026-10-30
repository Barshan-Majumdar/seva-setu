/**
 * voiceFormParser.js — AI-Powered Voice Form Extraction Service
 * Uses Google Gemini (with regex/heuristic fallback) to parse natural speech
 * into structured incident form fields along with word-to-field matching trace.
 */

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are SevaSetu Voice Form Assistant. Your task is to analyze a spoken incident report transcript and extract structured data to auto-fill an emergency incident field form.

Available Need Types:
- "medical": injuries, unconsciousness, medical emergency, bleeding, illness, doctor/ambulance needed
- "accidental": car crash, traffic accident, vehicle collision, falling, structural hazard
- "food": drinking water shortage, starvation, food supplies, ration needed
- "shelter": homeless, displaced by storm/flood, roof destroyed, temporary shelter needed
- "rescue": trapped under debris, flood rescue, fire rescue, boat needed, evacuation
- "other": general distress, power failure, infrastructure or unspecified aid

You MUST return ONLY valid JSON matching this schema:
{
  "need_type": "medical" | "accidental" | "food" | "shelter" | "rescue" | "other",
  "people_affected": number or null,
  "children_count": number or null,
  "adults_count": number or null,
  "pregnant_count": number or null,
  "district": string or null,
  "ward": string or null,
  "contact_number": string or null,
  "title": string (concise headline, max 70 chars),
  "description": string (clear narrative with context and hazards),
  "is_disaster_zone": boolean (true if severe crisis like flood, building collapse, major fire, widespread casualties),
  "field_matches": {
    "need_type": { "value": string, "matched_text": string, "reason": string },
    "people_affected": { "value": number or null, "matched_text": string },
    "children_count": { "value": number or null, "matched_text": string },
    "adults_count": { "value": number or null, "matched_text": string },
    "pregnant_count": { "value": number or null, "matched_text": string },
    "district": { "value": string or null, "matched_text": string },
    "ward": { "value": string or null, "matched_text": string },
    "contact_number": { "value": string or null, "matched_text": string },
    "title": { "value": string, "matched_text": string },
    "is_disaster_zone": { "value": boolean, "matched_text": string }
  }
}

Important Rules:
1. "matched_text" must be the exact substring or phrase from the transcript that prompted the extraction.
2. If a field was not mentioned in the transcript, set its value to null (or empty string/false) and matched_text to "".
3. Standardize Indian phone numbers (10 digits, e.g. "9876543210").
4. "title" should be punchy and informative (e.g. "Building Collapse near Central Market").
5. Return JSON only, with no markdown code blocks or preamble.`;

/**
 * Fallback parser using regex & heuristics if LLM is unavailable
 */
function fallbackParseTranscript(transcript) {
  const lower = transcript.toLowerCase();
  
  // Classification
  let need_type = 'other';
  let need_match = '';
  if (/fire|collapse|trapped|drowning|evacuat|stuck/i.test(lower)) {
    need_type = 'rescue';
    need_match = transcript.match(/fire|collapse|trapped|drowning|evacuat|stuck/i)?.[0] || 'rescue keywords';
  } else if (/bleed|injur|hurt|unconscious|ambulance|doctor|medic|hospital|sick|burn/i.test(lower)) {
    need_type = 'medical';
    need_match = transcript.match(/bleed|injur|hurt|unconscious|ambulance|doctor|medic|hospital|sick|burn/i)?.[0] || 'medical keywords';
  } else if (/accident|crash|collision|hit and run|overturn/i.test(lower)) {
    need_type = 'accidental';
    need_match = transcript.match(/accident|crash|collision|hit and run|overturn/i)?.[0] || 'accident keywords';
  } else if (/food|water|ration|starv|thirst|meal/i.test(lower)) {
    need_type = 'food';
    need_match = transcript.match(/food|water|ration|starv|thirst|meal/i)?.[0] || 'food keywords';
  } else if (/shelter|roof|homeless|displace|camp/i.test(lower)) {
    need_type = 'shelter';
    need_match = transcript.match(/shelter|roof|homeless|displace|camp/i)?.[0] || 'shelter keywords';
  }

  // Pregnant Women
  const pregMatch = transcript.match(/(\d+)?\s*(?:pregnant\s*(?:women|woman|lady|mother|mothers)?|expecting\s*mothers?|garbhvati|garbhavati|prasuti|pettik)\b/i);
  const pregnant_count = pregMatch ? (parseInt(pregMatch[1], 10) || 1) : null;
  const pregnant_match = pregMatch ? pregMatch[0] : '';

  // Children
  const childMatch = transcript.match(/(\d+)\s*(?:children|child|kids|kid|babies|baby|infants|infant|minors|minor|bacche|baccha|sishu|shishu)\b/i);
  const children_count = childMatch ? parseInt(childMatch[1], 10) : null;
  const children_match = childMatch ? childMatch[0] : '';

  // Adults
  const adultMatch = transcript.match(/(\d+)\s*(?:adults|adult|grownups|grownup|men|women|elderly|seniors|boroder)\b/i);
  const adults_count = adultMatch ? parseInt(adultMatch[1], 10) : (pregnant_count ? pregnant_count : null);
  const adults_match = adultMatch ? adultMatch[0] : '';

  // People affected
  const countMatch = transcript.match(/\b(\d+)\s*(?:people|persons|individuals|families|victims|casualties|patients)?\b/i);
  const people_affected = countMatch ? parseInt(countMatch[1], 10) : ((children_count || 0) + (adults_count || 0) || null);
  const people_match = countMatch ? countMatch[0] : '';

  // Phone number
  const phoneMatch = transcript.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
  const contact_number = phoneMatch ? phoneMatch[1] : '';
  const phone_match = phoneMatch ? phoneMatch[0] : '';

  // Ward / Area
  const wardMatch = transcript.match(/\b(?:ward|sector|block)\s*(?:no\.?|number)?\s*([0-9a-zA-Z]+)\b/i);
  const ward = wardMatch ? `Ward ${wardMatch[1]}` : '';
  const ward_text = wardMatch ? wardMatch[0] : '';

  // District heuristics (common regions / keywords)
  const distMatch = transcript.match(/\b(?:in|at|near|around)\s+([A-Z][a-zA-Z\s]{3,20})/);
  const district = distMatch ? distMatch[1].trim() : '';

  const is_disaster_zone = /collapse|disaster|flood|explosion|major fire|cyclone/i.test(lower);

  const title = transcript.length > 60 ? transcript.slice(0, 57) + '...' : transcript;

  return {
    need_type,
    people_affected,
    children_count,
    adults_count,
    pregnant_count,
    district,
    ward,
    contact_number,
    title,
    description: transcript,
    is_disaster_zone,
    field_matches: {
      need_type: { value: need_type, matched_text: need_match },
      people_affected: { value: people_affected, matched_text: people_match },
      children_count: { value: children_count, matched_text: children_match },
      adults_count: { value: adults_count, matched_text: adults_match },
      pregnant_count: { value: pregnant_count, matched_text: pregnant_match },
      district: { value: district, matched_text: distMatch?.[0] || '' },
      ward: { value: ward, matched_text: ward_text },
      contact_number: { value: contact_number, matched_text: phone_match },
      title: { value: title, matched_text: transcript.slice(0, 30) },
      is_disaster_zone: { value: is_disaster_zone, matched_text: is_disaster_zone ? 'Severe emergency indicator' : '' }
    }
  };
}

/**
 * Main parser function
 */
async function parseVoiceTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Transcript is required');
  }

  const cleanTranscript = transcript.trim();

  // Try Gemini AI first if API key is present
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        },
        contents: [{ role: 'user', parts: [{ text: cleanTranscript }] }]
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          source: 'gemini-2.5-flash',
          transcript: cleanTranscript,
          ...parsed
        };
      }
    } catch (geminiError) {
      console.warn('[VoiceFormParser] Gemini parsing error, using fallback:', geminiError.message);
    }
  }

  // Local fallback
  const fallback = fallbackParseTranscript(cleanTranscript);
  return {
    source: 'heuristic-fallback',
    transcript: cleanTranscript,
    ...fallback
  };
}

module.exports = {
  parseVoiceTranscript,
  fallbackParseTranscript
};

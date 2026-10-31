import json
import os
import re
import requests
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# Load GEMINI_API_KEY from server/.env or environment
server_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', '.env')
if os.path.exists(server_env):
    with open(server_env, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                val = line.split("=", 1)[1].strip('"').strip("'")
                if val:
                    os.environ["GEMINI_API_KEY"] = val
                break

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

class FactExtractionRequest(BaseModel):
    transcript: str
    language: Optional[str] = "en-IN"

class NlpModule:
    def __init__(self):
        pass

    def extract_facts(self, transcript: str) -> Dict[str, Any]:
        """
        Extracts structured emergency facts and intent from voice transcripts.
        1. Checks deterministic negation and safety filters first.
        2. Tries Gemini LLM if key is available.
        3. If Gemini is unavailable, rate-limited (429), or fails, executes high-precision
           deterministic NLP engine with multi-lingual number parsing and priority mapping.
        """
        clean_text = (transcript or "").strip()
        if not clean_text:
            return {
                "intent": "UNKNOWN",
                "facts": self._empty_facts(),
                "confidenceByField": {},
                "modelVersion": "sevasetu-nlp-empty",
                "isEmergency": False,
                "reply": "I am listening. Please describe your emergency."
            }

        # Stage 1: Deterministic Negation & Safety Filter Check
        negation_result = self._check_negation_and_safety(clean_text)
        if negation_result:
            return negation_result

        # Stage 2: Try LLM if configured
        if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("AQ.Ab8RN6Ksj"):
            llm_res = self._try_gemini_extract(clean_text)
            if llm_res:
                return llm_res

        # Stage 3: High-precision Deterministic Rule Engine
        return self._deterministic_extract(clean_text)

    def _empty_facts(self) -> Dict[str, Any]:
        return {
            "emergencyType": "UNKNOWN",
            "severitySignals": [],
            "peopleCount": None,
            "womenCount": None,
            "childrenCount": None,
            "pregnantCount": None,
            "injuredCount": None,
            "trapped": False,
            "fire": False,
            "district": None,
            "area": None,
            "landmark": None,
            "hazards": [],
            "confidenceByField": {}
        }

    def _check_negation_and_safety(self, text: str) -> Optional[Dict[str, Any]]:
        t = text.lower().strip()

        # Direct safe / cancel statements
        safe_phrases = [
            "i am safe", "i am fine", "i am okay", "no emergency", "false alarm",
            "everything is fine", "all good", "we are safe", "we are fine",
            "there is no emergency", "actually no emergency", "not in danger",
            "do not need help", "dont need help", "cancel emergency", "cancel"
        ]
        if any(p in t for p in safe_phrases):
            return {
                "intent": "SAFE" if "cancel" not in t else "CANCEL",
                "facts": self._empty_facts(),
                "confidenceByField": {"safety": 0.99},
                "modelVersion": "sevasetu-safety-guard",
                "isEmergency": False,
                "reply": "Glad to hear that you are safe. Session closed." if "cancel" not in t else "Emergency session cancelled."
            }

        # Direct inquiry checks
        if any(q in t for q in ["who are you", "what are you", "what is sevasetu", "what is seva setu", "introduce yourself"]):
            return {
                "intent": "INFO",
                "facts": self._empty_facts(),
                "confidenceByField": {"info": 0.99},
                "modelVersion": "sevasetu-safety-guard",
                "isEmergency": False,
                "reply": "I am Seva Setu, your voice-activated emergency relief assistant. Is there an emergency right now?"
            }

        # Direct connection checks
        if any(h in t for h in ["can you hear me", "are you listening", "hello", "hi"]):
            # Only if not combined with an emergency word
            if not any(e in t for e in ["fire", "injured", "hurt", "trapped", "flood", "accident", "edc", "help", "ambulance"]):
                return {
                    "intent": "QUERY_DETAILS",
                    "facts": self._empty_facts(),
                    "confidenceByField": {"status": 0.95},
                    "modelVersion": "sevasetu-safety-guard",
                    "isEmergency": False,
                    "reply": "Yes, I can hear you clearly! Please describe what is happening."
                }

        return None

    def _try_gemini_extract(self, transcript: str) -> Optional[Dict[str, Any]]:
        try:
            system_prompt = """You are Seva Setu, an intelligent AI disaster and emergency relief assistant.
Analyze the user's voice transcript and categorize their intent, extracting structured facts.

RULES:
1. Identify emergency categories: MEDICAL, FIRE, RESCUE, ACCIDENT, FLOOD, HELP, EDC, or GENERAL_EMERGENCY.
   - If road accidents, vehicle crashes, collisions are mentioned, intent is ACCIDENT (even if victims are injured).
   - If fire, burning, smoke is mentioned, intent is FIRE.
   - If trapped, building collapse is mentioned, intent is RESCUE.
   - If flood, drowning is mentioned, intent is FLOOD.
   - If illness, bleeding, medical trauma without crash/fire is mentioned, intent is MEDICAL.
2. If user mentions EDC, map intent to EDC with isEmergency: true.
3. If user says 'please send help', 'help me', 'we need help', map intent to HELP with isEmergency: true.
4. If negated ('no fire', 'there is no accident', 'not hurt'), isEmergency must be false.
5. Extract peopleCount, womenCount, childrenCount, pregnantCount, injuredCount as numbers.
6. trapped: true if people are trapped/stuck/collapsed.
7. fire: true if fire/smoke/burning reported.

Output ONLY valid JSON matching this schema:
{
    "intent": "MEDICAL" | "FIRE" | "RESCUE" | "ACCIDENT" | "FLOOD" | "HELP" | "EDC" | "GENERAL_EMERGENCY" | "SAFE" | "INFO" | "QUERY_DETAILS",
    "isEmergency": boolean,
    "reply": string,
    "facts": {
        "severitySignals": string[],
        "peopleCount": number | null,
        "womenCount": number | null,
        "childrenCount": number | null,
        "pregnantCount": number | null,
        "injuredCount": number | null,
        "trapped": boolean,
        "fire": boolean,
        "district": string | null,
        "area": string | null,
        "landmark": string | null
    }
}"""
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": transcript}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"}
            }
            
            response = requests.post(url, json=payload, timeout=5)
            if response.status_code == 200:
                res_data = response.json()
                result_str = res_data["candidates"][0]["content"]["parts"][0]["text"]
                data = json.loads(result_str)
                extracted_facts = data.get("facts", {})
                
                # Reconcile peopleCount and injuredCount
                p_cnt = extracted_facts.get("peopleCount")
                inj_cnt = extracted_facts.get("injuredCount")
                if p_cnt is None and inj_cnt is not None:
                    extracted_facts["peopleCount"] = inj_cnt
                elif inj_cnt is None and p_cnt is not None:
                    extracted_facts["injuredCount"] = p_cnt

                # Standardize severitySignals
                signals = extracted_facts.get("severitySignals") or []
                signals_lower = [str(s).lower() for s in signals]
                if any("injur" in s or "hurt" in s or "bleed" in s for s in signals_lower) or (inj_cnt and inj_cnt > 0):
                    if "injury" not in signals:
                        signals.append("injury")
                if extracted_facts.get("fire") and "fire" not in signals:
                    signals.append("fire")
                if extracted_facts.get("trapped") and "trapped" not in signals:
                    signals.append("trapped")
                extracted_facts["severitySignals"] = signals

                intent = data.get("intent", "GENERAL_EMERGENCY")
                t_low = transcript.lower()
                if any(w in t_low for w in ["accident", "crash", "collision"]) and intent not in ["SAFE", "CANCEL", "INFO"]:
                    intent = "ACCIDENT"
                elif any(w in t_low for w in ["fire", "flames", "burning"]) and intent not in ["SAFE", "CANCEL", "INFO"]:
                    intent = "FIRE"
                elif any(w in t_low for w in ["edc", "e.d.c."]) and intent not in ["SAFE", "CANCEL", "INFO"]:
                    intent = "EDC"

                return {
                    "intent": intent,
                    "facts": extracted_facts,
                    "confidenceByField": {},
                    "modelVersion": "gemini-2.5-flash-rest",
                    "isEmergency": data.get("isEmergency", True),
                    "reply": data.get("reply", "Emergency reported. Dispatching assistance immediately.")
                }
        except Exception as e:
            # Silently fall back to deterministic engine on network, quota, or parsing error
            pass
        return None

    def _deterministic_extract(self, transcript: str) -> Dict[str, Any]:
        t = transcript.lower().strip()
        words = re.findall(r'\b[\w\.-]+\b', t)

        facts = self._empty_facts()
        confidence = {}

        # ── 1. Proximity Negation Check for Specific Triggers ──
        # Looks for negation within 3 words before a trigger
        negation_tokens = {"no", "not", "dont", "don't", "never", "without", "false", "hardly", "neither", "nor"}
        def is_negated(target_words: List[str]) -> bool:
            for tw in target_words:
                target_re = re.compile(r'\b' + re.escape(tw) + r'\b')
                for match in target_re.finditer(t):
                    start_char = match.start()
                    prefix_text = t[:start_char]
                    prefix_words = re.findall(r'\b[\w\']+\b', prefix_text)
                    window = prefix_words[-3:] if len(prefix_words) >= 3 else prefix_words
                    if any(w in negation_tokens for w in window):
                        return True
            return False

        # ── 2. Demographic Headcount Parsing ──
        num_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
            'ek': 1, 'do': 2, 'dui': 2, 'teen': 3, 'tin': 3, 'char': 4, 'chaar': 4,
            'panch': 5, 'paanch': 5, 'chhe': 6, 'chhoy': 6, 'saat': 7, 'sat': 7,
            'aath': 8, 'ath': 8, 'nau': 9, 'noy': 9, 'das': 10, 'dosh': 10
        }
        num_pattern = r'(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|ek|do|dui|teen|tin|char|chaar|panch|paanch|chhe|chhoy|saat|sat|aath|ath|nau|noy|das|dosh)'

        def parse_num(val_str: str) -> int:
            val_str = val_str.lower().strip()
            if val_str.isdigit():
                return int(val_str)
            return num_words.get(val_str, 1)

        # Children
        child_m = re.search(num_pattern + r'\s*(?:children|child|kids|kid|babies|baby|infants|infant|minors|minor|bacche|baccha|sishu)', t)
        if child_m:
            facts["childrenCount"] = parse_num(child_m.group(1))

        # Women
        women_m = re.search(num_pattern + r'\s*(?:women|woman|ladies|lady|female|females|mahila|mohila|aurat)', t)
        if women_m:
            facts["womenCount"] = parse_num(women_m.group(1))

        # Pregnant
        preg_m = re.search(num_pattern + r'?\s*(?:pregnant|expecting mother|garbhvati|garbhavati|prasuti)', t)
        if preg_m:
            facts["pregnantCount"] = parse_num(preg_m.group(1)) if preg_m.group(1) else 1
        elif 'pregnant' in t or 'garbhvati' in t or 'prasuti' in t:
            facts["pregnantCount"] = 1

        # Injured Count
        injured_m = re.search(num_pattern + r'\s*(?:people\s+are\s+injured|people\s+injured|injured|hurt|wounded|bleeding|casualties|ghayal|rokto)', t)
        if injured_m:
            facts["injuredCount"] = parse_num(injured_m.group(1))

        # General People Count
        people_m = re.search(num_pattern + r'\s*(?:people|persons|victims|casualties|manush|jon|log|vyakti)', t)
        if people_m:
            facts["peopleCount"] = parse_num(people_m.group(1))
        elif facts["injuredCount"]:
            facts["peopleCount"] = facts["injuredCount"]
        elif facts["womenCount"] or facts["childrenCount"]:
            facts["peopleCount"] = (facts["womenCount"] or 0) + (facts["childrenCount"] or 0)

        # ── 3. Categorical Triggers Evaluation ──
        detected_categories = []

        # A. Fire
        FIRE_TRIGGERS = ["fire", "burning", "smoke", "flames", "ablaze", "house fire", "cylinder blast", "aag", "agun", "jalche"]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in FIRE_TRIGGERS):
            if not is_negated(FIRE_TRIGGERS):
                facts["fire"] = True
                facts["severitySignals"].append("fire")
                detected_categories.append("FIRE")

        # B. Medical
        MEDICAL_TRIGGERS = [
            "medical", "injured", "injury", "injuries", "hurt", "bleeding", "blood", "wound", "wounds",
            "heart attack", "chest pain", "unconscious", "stroke", "ambulance", "hospital", "doctor",
            "ghayal", "rokto", "chot", "oshustho", "seizure", "casualties", "casualty"
        ]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in MEDICAL_TRIGGERS):
            if not is_negated(MEDICAL_TRIGGERS):
                facts["severitySignals"].append("injury")
                detected_categories.append("MEDICAL")

        # C. Rescue / Trapped
        RESCUE_TRIGGERS = [
            "rescue", "trapped", "stuck", "buried", "collapsed", "under debris",
            "building collapse", "wall fell", "locked inside", "fas gaya", "aatke", "atke"
        ]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in RESCUE_TRIGGERS):
            if not is_negated(RESCUE_TRIGGERS):
                facts["trapped"] = True
                facts["severitySignals"].append("trapped")
                detected_categories.append("RESCUE")

        # D. Accident
        ACCIDENT_TRIGGERS = [
            "accident", "crash", "collision", "car crash", "road accident",
            "vehicle accident", "hit and run", "durghatna", "durghotona"
        ]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in ACCIDENT_TRIGGERS):
            if not is_negated(ACCIDENT_TRIGGERS):
                facts["severitySignals"].append("accident")
                detected_categories.append("ACCIDENT")

        # E. Flood / Disaster
        FLOOD_TRIGGERS = [
            "flood", "flooding", "drowning", "drowned", "underwater", "water rising",
            "cyclone", "storm", "hurricane", "tsunami", "landslide", "baadh", "bonna"
        ]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in FLOOD_TRIGGERS):
            if not is_negated(FLOOD_TRIGGERS):
                facts["severitySignals"].append("flood")
                detected_categories.append("FLOOD")

        # F. EDC Trigger (Explicit requirement)
        EDC_TRIGGERS = ["edc", "e.d.c.", "e d c"]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in EDC_TRIGGERS) or t.strip() in EDC_TRIGGERS:
            if not is_negated(EDC_TRIGGERS):
                facts["severitySignals"].append("edc")
                detected_categories.append("EDC")

        # G. General Help Trigger
        HELP_TRIGGERS = [
            "help", "send help", "help me", "please help", "need assistance",
            "emergency", "bachao", "sahayata", "banchao"
        ]
        if any(re.search(r'\b' + re.escape(w) + r'\b', t) for w in HELP_TRIGGERS):
            if not is_negated(HELP_TRIGGERS):
                if not detected_categories:
                    detected_categories.append("HELP")

        # ── 4. Final Intent Determination ──
        # Strict Category Priority: ACCIDENT > FIRE > RESCUE > MEDICAL > FLOOD > EDC > HELP
        PRIORITY_ORDER = ["ACCIDENT", "FIRE", "RESCUE", "MEDICAL", "FLOOD", "EDC", "HELP"]
        primary_intent = None
        for cat in PRIORITY_ORDER:
            if cat in detected_categories:
                primary_intent = cat
                break

        if primary_intent:
            facts["emergencyType"] = primary_intent
            is_emergency = True
            reply = "We have received your distress signal. You are not alone. Assistance is being coordinated."
        else:
            primary_intent = "QUERY_DETAILS"
            is_emergency = False
            reply = "I am listening. Please describe your emergency or let me know what assistance you need."

        return {
            "intent": primary_intent,
            "facts": facts,
            "confidenceByField": confidence,
            "modelVersion": "sevasetu-deterministic-nlp-v2",
            "isEmergency": is_emergency,
            "reply": reply
        }

nlp_module = NlpModule()

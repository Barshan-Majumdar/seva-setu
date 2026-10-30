import json
import os
import re
import requests
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Attempt to load LLM client if GEMINI_API_KEY is available
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    server_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', '.env')
    if os.path.exists(server_env):
        with open(server_env, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    GEMINI_API_KEY = line.split("=", 1)[1].strip('"').strip("'")
                    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
                    break

class FactExtractionRequest(BaseModel):
    transcript: str
    language: Optional[str] = "en-IN"

class NlpModule:
    def __init__(self):
        pass

    def extract_facts(self, transcript: str) -> Dict[str, Any]:
        """
        Uses Gemini LLM to understand the user's intent conversationally.
        Falls back to comprehensive regex/keyword extraction if LLM fails or is unavailable.
        """
        if GEMINI_API_KEY:
            try:
                system_prompt = """You are Seva Setu, an intelligent AI disaster and emergency relief assistant.
Analyze the user's voice transcript and categorize their intent, extracting structured facts.

CONVERSATIONAL RULES:
1. GPS location is captured automatically in the background. NEVER ask for their GPS location or address.
2. If the user asks who you are or what this is (e.g. 'who are you', 'what is seva setu', 'what can you do', 'introduce yourself'):
   - intent: 'INFO'
   - isEmergency: false
   - reply: 'I am Seva Setu, your disaster and emergency relief assistant. Is there an emergency right now?'
3. If the user indicates they are safe, there is no emergency, or says 'no' / 'cancel' / 'all good' / 'no emergency' / 'safe':
   - intent: 'SAFE'
   - isEmergency: false
   - reply: 'Glad to hear that. Closing the session now. Stay safe!'
4. If the user says 'yes' or says they have an emergency but has NOT yet described the kind of emergency:
   - intent: 'QUERY_DETAILS'
   - isEmergency: false
   - reply: 'I am listening. What kind of emergency is happening? Please describe what you see or need.'
5. If the user reports an emergency (e.g. fire, trapped, flood, accident, injuries, medical, disaster):
   - intent: 'FIRE', 'ACCIDENT', 'MEDICAL', 'RESCUE', 'FLOOD', or 'GENERAL_EMERGENCY'
   - isEmergency: true
   - reply: Short, reassuring confirmation that emergency response is being dispatched immediately (e.g. 'Emergency reported. Dispatching rescue teams to your location immediately. Please stay safe.')
6. Extract demographic counts from the speech into facts:
   - peopleCount: total number of people mentioned (e.g. '5 people' -> 5)
   - womenCount: number of women or female victims mentioned (e.g. '2 women' -> 2)
   - childrenCount: number of children, kids, babies mentioned (e.g. '1 child' -> 1)
   - pregnantCount: number of pregnant women mentioned, or null
   - trapped: true if user or people are trapped or stuck, else false
   - fire: true if fire/smoke/burning is mentioned, else false
   - district / area / landmark: any specific locations mentioned, else null

You must output ONLY raw JSON.
Schema:
{
    "intent": "INFO" | "SAFE" | "CANCEL" | "QUERY_DETAILS" | "FIRE" | "ACCIDENT" | "MEDICAL" | "RESCUE" | "FLOOD" | "GENERAL_EMERGENCY" | "UNKNOWN",
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
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                
                response = requests.post(url, json=payload, timeout=12)
                response.raise_for_status()
                
                res_data = response.json()
                result_str = res_data["candidates"][0]["content"]["parts"][0]["text"]
                data = json.loads(result_str)
                
                print(f"[NLP] Gemini LLM Extracted: {data}")
                
                return {
                    "intent": data.get("intent", "UNKNOWN"),
                    "facts": data.get("facts", {}),
                    "confidenceByField": {},
                    "modelVersion": "gemini-2.5-flash-rest",
                    "isEmergency": data.get("isEmergency", False),
                    "reply": data.get("reply", "Understood.")
                }
            except Exception as e:
                print(f"[NLP] LLM REST extraction failed: {e}. Falling back to keyword search.")

        # ---- FALLBACK KEYWORD LOGIC ----
        t = transcript.lower()

        facts = {
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

        confidence = {}

        def has_word(word, text):
            return bool(re.search(r'\b' + re.escape(word) + r'\b', text))

        def has_any(words, text):
            return any(has_word(w, text) for w in words)

        num_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'ek': 1, 'do': 2, 'dui': 2, 'teen': 3, 'tin': 3, 'char': 4, 'chaar': 4,
            'panch': 5, 'paanch': 5, 'chhe': 6, 'chhoy': 6, 'saat': 7, 'sat': 7,
            'aath': 8, 'ath': 8, 'nau': 9, 'noy': 9, 'das': 10, 'dosh': 10
        }
        num_pattern = r'(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|dui|teen|tin|char|chaar|panch|paanch|chhe|chhoy|saat|sat|aath|ath|nau|noy|das|dosh)'

        # Demographics: Children
        child_m = re.search(num_pattern + r'\s*(?:children|child|kids|kid|babies|baby|infants|infant|minors|minor|bacche|baccha|bachhe|bachha|chhotoder|chotoder|sishu|shishu|baccho)', t)
        if child_m:
            raw = child_m.group(1).lower()
            facts["childrenCount"] = num_words.get(raw, int(raw) if raw.isdigit() else 1)

        # Demographics: Women
        women_m = re.search(num_pattern + r'\s*(?:women|woman|ladies|lady|female|females|mahila|mohila|nari|aurat)', t)
        if women_m:
            raw = women_m.group(1).lower()
            facts["womenCount"] = num_words.get(raw, int(raw) if raw.isdigit() else 1)

        # Demographics: Pregnant
        preg_m = re.search(num_pattern + r'?\s*(?:pregnant|expecting mother|garbhvati|garbhavati|prasuti|antarshatta)', t)
        if preg_m and preg_m.group(1):
            raw = preg_m.group(1).lower()
            facts["pregnantCount"] = num_words.get(raw, int(raw) if raw.isdigit() else 1)
        elif 'pregnant' in t or 'garbhvati' in t or 'prasuti' in t:
            facts["pregnantCount"] = 1

        # Demographics: Total People
        people_m = re.search(num_pattern + r'\s*(?:people|persons|victims|casualties|manush|jon|log|vyakti|bektigono)', t)
        if people_m:
            raw = people_m.group(1).lower()
            facts["peopleCount"] = num_words.get(raw, int(raw) if raw.isdigit() else 1)
        elif facts["womenCount"] or facts["childrenCount"]:
            facts["peopleCount"] = (facts["womenCount"] or 0) + (facts["childrenCount"] or 0)

        # ── Fire ─────────────────────────────────────────────────────────
        FIRE_WORDS = [
            "fire", "burning", "smoke", "flames", "ablaze", "on fire",
            "house fire", "forest fire", "gas fire", "cylinder blast",
            "aag", "aag lagi", "jalraha", "agun", "aagun", "jalche",
            "dhoan", "dhonwa",
        ]
        if has_any(FIRE_WORDS, t):
            facts["fire"] = True
            facts["emergencyType"] = "FIRE"
            facts["severitySignals"].append("fire")
            confidence["fire"] = 0.98

        # ── Accident / Crash ──────────────────────────────────────────────
        ACCIDENT_WORDS = [
            "accident", "crash", "collision", "car crash", "vehicle accident",
            "road accident", "bike accident", "hit and run", "rollover",
            "durghatna", "durghotona",
        ]
        if has_any(ACCIDENT_WORDS, t):
            facts["emergencyType"] = "ACCIDENT"
            confidence["emergencyType"] = 0.95

        # ── Medical Emergency ─────────────────────────────────────────────
        MEDICAL_WORDS = [
            "injured", "hurt", "bleeding", "blood", "heart attack", "chest pain",
            "breathing", "cannot breathe", "can't breathe", "not breathing",
            "unconscious", "fainted", "seizure", "stroke", "paralyzed",
            "ambulance", "hospital", "doctor", "medical", "electric shock",
            "chot", "ghayal", "rokto", "khon", "mariz", "rogi", "oshustho",
        ]
        if has_any(MEDICAL_WORDS, t):
            facts["severitySignals"].append("injury")
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "MEDICAL"

        # ── Trapped / Collapsed ───────────────────────────────────────────
        TRAPPED_WORDS = [
            "trapped", "stuck", "buried", "collapsed", "under debris",
            "building collapsed", "wall fell", "roof fell", "cannot get out",
            "locked inside", "trapped inside", "atke", "aatke", "aatkegachi",
            "fas gaya", "phase", "bhange poreche", "gir gaya",
        ]
        if has_any(TRAPPED_WORDS, t):
            facts["trapped"] = True
            facts["severitySignals"].append("trapped")
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "GENERAL_EMERGENCY"
            confidence["trapped"] = 0.96

        # ── Natural Disaster / Flood ──────────────────────────────────────
        DISASTER_WORDS = [
            "flood", "flooding", "drowning", "drowned", "underwater",
            "water rising", "swept away", "cyclone", "storm", "hurricane",
            "earthquake", "landslide", "tsunami", "baadh", "tufan", "bonna",
            "bannya", "jol", "pani", "dubche",
        ]
        if has_any(DISASTER_WORDS, t):
            facts["emergencyType"] = "FLOOD" if "flood" in t or "drown" in t else "GENERAL_EMERGENCY"
            facts["severitySignals"].append("disaster")

        is_emergency = facts["emergencyType"] != "UNKNOWN" or len(facts["severitySignals"]) > 0

        reply = ""
        intent_override = facts["emergencyType"]

        if is_emergency:
            reply = f"Emergency reported. Dispatching rescue teams to your location immediately. Please stay safe."
        else:
            if "who are you" in t or "what are you" in t or "introduce yourself" in t or "what is seva setu" in t:
                reply = "I am Seva Setu, your disaster and emergency relief assistant. Is there an emergency right now?"
                intent_override = "INFO"
            elif has_any(["i am safe", "i am fine", "i am okay", "no emergency", "false alarm", "everything is fine", "all good", "safe"], t) or \
                 re.search(r'\bno\b', t) is not None:
                reply = "Glad to hear that. Closing the session now. Stay safe!"
                intent_override = "SAFE"
            elif re.search(r'\b(yes|yeah|yep|haan|ha|help me)\b', t) is not None:
                reply = "I am listening. What kind of emergency is happening? Please describe what you see or need."
                intent_override = "QUERY_DETAILS"
            elif has_any(["cancel", "stop", "nevermind", "never mind", "abort", "close session"], t):
                reply = "Okay, closing the session. Stay safe!"
                intent_override = "CANCEL"
            else:
                reply = "I am listening. Please describe your emergency or let me know if you need help."
                intent_override = "QUERY_DETAILS"

        return {
            "intent": intent_override,
            "facts": facts,
            "confidenceByField": confidence,
            "modelVersion": "sevasetu-nlp-keyword-fallback",
            "isEmergency": is_emergency,
            "reply": reply
        }

nlp_module = NlpModule()

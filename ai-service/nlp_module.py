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
        Uses an LLM (if available) to truly understand the user's intent.
        Falls back to keyword extraction if LLM fails or is unavailable.
        """
        if GEMINI_API_KEY:
            try:
                system_prompt = """You are Seva Setu, an AI emergency dispatcher. 
Categorize the user's voice transcript intelligently. 
IMPORTANT: GPS location is already captured automatically in the background. DO NOT ASK the user for their location, address, or whereabouts. 
If they report an emergency, just say you are sending help to their location immediately.
If they say there is NO emergency, set isEmergency to false.
You must output ONLY raw JSON.
Schema:
{
    "intent": "string", // "SAFE", "CANCEL", "GENERAL_EMERGENCY", "ACCIDENT", "FIRE", "MEDICAL", or "UNKNOWN"
    "isEmergency": boolean, // true ONLY if it's a genuine emergency. false if they are safe, testing, or cancelling.
    "reply": "string", // A short conversational response to speak back to the user (e.g. "I'm glad you're safe, closing session.", or "Sending help to your location now.")
    "facts": {
        "severitySignals": ["list", "of", "keywords"],
        "peopleCount": null,
        "injuredCount": null,
        "trapped": false,
        "fire": false
    }
}"""
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": transcript}]}],
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                
                response = requests.post(url, json=payload, timeout=15)
                response.raise_for_status()
                
                res_data = response.json()
                result_str = res_data["candidates"][0]["content"]["parts"][0]["text"]
                
                data = json.loads(result_str)
                
                print(f"[NLP] Fast REST API LLM Extracted: {data}")
                
                return {
                    "intent": data.get("intent", "UNKNOWN"),
                    "facts": data.get("facts", {}),
                    "confidenceByField": {},
                    "modelVersion": "gemini-3.5-flash-lite-rest",
                    "isEmergency": data.get("isEmergency", False),
                    "reply": data.get("reply", "Understood.")
                }
            except Exception as e:
                print(f"[NLP] LLM REST extraction failed: {e}. Falling back to keyword search.")

        # ---- FALLBACK KEYWORD LOGIC ----
        # NOTE: All "contains" checks use whole-word boundaries via regex or
        # explicit substring guards to avoid false positives.
        # E.g. "no" must not match inside "cannot", "notice", "another".
        t = transcript.lower()

        facts = {
            "emergencyType": "UNKNOWN",
            "severitySignals": [],
            "peopleCount": None,
            "injuredCount": None,
            "trapped": False,
            "fire": False,
            "hazards": [],
            "confidenceByField": {}
        }

        confidence = {}

        def has_word(word, text):
            """Whole-word match — prevents 'cannot' matching 'no'."""
            return bool(re.search(r'\b' + re.escape(word) + r'\b', text))

        def has_any(words, text):
            return any(has_word(w, text) for w in words)

        # ── Accident / Crash ──────────────────────────────────────────────
        ACCIDENT_WORDS = [
            "accident", "crash", "collision", "car crash", "vehicle accident",
            "road accident", "bike accident", "hit and run", "rollover",
        ]
        if has_any(ACCIDENT_WORDS, t):
            facts["emergencyType"] = "ACCIDENT"
            confidence["emergencyType"] = 0.95

        # ── Fire ─────────────────────────────────────────────────────────
        FIRE_WORDS = [
            "fire", "burning", "smoke", "flames", "ablaze", "on fire",
            "house fire", "forest fire", "gas fire", "cylinder blast",
            "aag", "aag lagi", "jalraha",  # Hindi phonetics
        ]
        if has_any(FIRE_WORDS, t):
            facts["fire"] = True
            facts["emergencyType"] = "FIRE"
            facts["severitySignals"].append("fire")
            confidence["fire"] = 0.98

        # ── Medical Emergency ─────────────────────────────────────────────
        MEDICAL_WORDS = [
            "injured", "hurt", "bleeding", "blood", "heart attack", "chest pain",
            "breathing", "cannot breathe", "can't breathe", "not breathing",
            "unconscious", "fainted", "seizure", "stroke", "paralyzed",
            "poison", "poisoned", "overdose", "bite", "snake bite",
            "ambulance", "hospital", "doctor", "medical", "electric shock",
            "choking", "vomiting blood", "severe pain",
            "dard", "chot", "behosh",  # Hindi phonetics
        ]
        if has_any(MEDICAL_WORDS, t):
            if "injury" not in facts["severitySignals"]:
                facts["severitySignals"].append("injury")
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "MEDICAL"
            confidence["injuredCount"] = 0.85

        # ── Trapped / Collapsed ───────────────────────────────────────────
        TRAPPED_WORDS = [
            "trapped", "stuck", "buried", "collapsed", "under debris",
            "building collapsed", "wall fell", "roof fell", "cannot get out",
            "locked inside", "fallen building",
        ]
        if has_any(TRAPPED_WORDS, t):
            facts["trapped"] = True
            if "trapped" not in facts["severitySignals"]:
                facts["severitySignals"].append("trapped")
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "GENERAL_EMERGENCY"
            confidence["trapped"] = 0.96

        # ── Natural Disaster ──────────────────────────────────────────────
        DISASTER_WORDS = [
            "flood", "flooding", "drowning", "drowned", "underwater",
            "water rising", "swept away", "cyclone", "storm", "hurricane",
            "earthquake", "landslide", "tsunami", "volcano",
            "baadh", "tufan", "bhukamp",  # Hindi phonetics
        ]
        if has_any(DISASTER_WORDS, t):
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "GENERAL_EMERGENCY"
            if "disaster" not in facts["severitySignals"]:
                facts["severitySignals"].append("disaster")
            confidence["emergencyType"] = 0.9

        # ── General Distress ──────────────────────────────────────────────
        DISTRESS_WORDS = [
            "help", "save me", "save us", "emergency", "sos", "mayday",
            "danger", "attack", "assault", "robbery", "shooting", "stabbing",
            "dying", "about to die", "going to die", "critical",
            "bachao", "madad", "bachao mujhe",  # Hindi phonetics
        ]
        if has_any(DISTRESS_WORDS, t):
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "GENERAL_EMERGENCY"
            confidence["emergencyType"] = 0.8

        facts["confidenceByField"] = confidence

        is_emergency = facts["emergencyType"] != "UNKNOWN" or len(facts["severitySignals"]) > 0

        reply = ""
        intent_override = facts["emergencyType"]

        if not is_emergency:
            if has_any(["listen", "hello", "hi there", "are you there", "seva setu"], t):
                reply = "Yes, I am listening. Please state your emergency."
            elif "who are you" in t or "what are you" in t or "how does this work" in t:
                reply = "I am Seva Setu, your emergency assistant. How can I help?"
            # CRITICAL FIX: Use whole-word check for "safe", "fine", "okay" (positive signals)
            elif has_any(["i am safe", "i am fine", "i am okay", "no emergency", "false alarm", "everything is fine", "all good"], t):
                reply = "Glad to hear you are safe. Closing the emergency assistant."
                intent_override = "SAFE"
            # CRITICAL FIX: Use strict whole-word regex for cancel — NOT substring.
            # "cannot" must NOT trigger this branch.
            elif has_any(["cancel", "stop", "nevermind", "never mind", "abort", "close session"], t) or \
                 re.search(r'\bno\b', t) is not None:
                # Extra guard: if transcript also contains emergency signals, do NOT cancel
                if not is_emergency:
                    reply = "Okay, cancelling emergency request."
                    intent_override = "CANCEL"
            else:
                reply = "I didn't detect an emergency. Are you safe?"

        return {
            "intent": intent_override,
            "facts": facts,
            "confidenceByField": confidence,
            "modelVersion": "sevasetu-nlp-0.1-qwen-simulated",
            "isEmergency": is_emergency,
            "reply": reply
        }

nlp_module = NlpModule()

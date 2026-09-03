import json
import os
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
        transcript_lower = transcript.lower()
        
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

        if "accident" in transcript_lower or "crash" in transcript_lower:
            facts["emergencyType"] = "ACCIDENT"
            confidence["emergencyType"] = 0.95
            
        if "fire" in transcript_lower or "burning" in transcript_lower:
            facts["fire"] = True
            facts["emergencyType"] = "FIRE"
            facts["severitySignals"].append("fire")
            confidence["fire"] = 0.98

        if "injured" in transcript_lower or "hurt" in transcript_lower or "bleeding" in transcript_lower:
            facts["severitySignals"].append("injury")
            confidence["injuredCount"] = 0.85

        if "trapped" in transcript_lower or "stuck" in transcript_lower:
            facts["trapped"] = True
            facts["severitySignals"].append("trapped")
            confidence["trapped"] = 0.96
            
        if "help" in transcript_lower or "save" in transcript_lower or "emergency" in transcript_lower or "sos" in transcript_lower:
            if facts["emergencyType"] == "UNKNOWN":
                facts["emergencyType"] = "GENERAL_EMERGENCY"
            confidence["emergencyType"] = 0.8

        facts["confidenceByField"] = confidence
        
        is_emergency = facts["emergencyType"] != "UNKNOWN" or len(facts["severitySignals"]) > 0
        
        reply = ""
        intent_override = facts["emergencyType"]
        
        if not is_emergency:
            if "listen" in transcript_lower or "hear" in transcript_lower or "hello" in transcript_lower or "hi" in transcript_lower:
                reply = "Yes, I am listening. Please state your emergency."
            elif "who are you" in transcript_lower or "what are you" in transcript_lower:
                reply = "I am Seva Setu, your emergency assistant. How can I help?"
            elif "yes" in transcript_lower or "fine" in transcript_lower or "safe" in transcript_lower or "okay" in transcript_lower or "good" in transcript_lower:
                reply = "Glad to hear you are safe. Closing the emergency assistant."
                intent_override = "SAFE"
            elif "no" in transcript_lower or "cancel" in transcript_lower or "stop" in transcript_lower:
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

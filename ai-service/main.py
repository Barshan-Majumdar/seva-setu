import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import io
import os
import requests
import whisper
from typing import Optional
from nlp_module import FactExtractionRequest, nlp_module

# ══════════════════════════════════════════════════════════════════════
# ENVIRONMENT SETUP
# ══════════════════════════════════════════════════════════════════════
# Load HF_TOKEN from environment. When running locally, set it in your
# shell or create ai-service/.env. We intentionally do NOT load the
# server/.env to avoid importing PORT=5000 which hijacks our port.
# ══════════════════════════════════════════════════════════════════════
try:
    from dotenv import load_dotenv
    # 1. Load ai-service's own .env (if it exists)
    local_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(local_env, override=False)
    
    # 2. Fallback: read ONLY HF_TOKEN from the server's .env (not the whole file)
    #    This avoids importing PORT=5000 which would hijack our port.
    if not os.environ.get("HF_TOKEN"):
        server_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', '.env')
        if os.path.exists(server_env):
            with open(server_env, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("HF_TOKEN="):
                        os.environ["HF_TOKEN"] = line.split("=", 1)[1]
                        print("[ENV] Loaded HF_TOKEN from server/.env")
                        break
except ImportError:
    pass

app = FastAPI(title="SevaSetu AI Verification Service")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════════
# MODEL LOADING
# ══════════════════════════════════════════════════════════════════════
HF_TOKEN = os.environ.get("HF_TOKEN")
MODEL_ID = "openai/clip-vit-large-patch14"

print(f"[AI-SERVICE] Loading model: {MODEL_ID}")
if HF_TOKEN:
    print(f"[AI-SERVICE] HF_TOKEN: {'*' * 4}{HF_TOKEN[-4:]}")  # Show last 4 chars only
else:
    print("[AI-SERVICE] WARNING: No HF_TOKEN set. Using unauthenticated access (slower downloads).")

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[AI-SERVICE] Device: {device}")

# Load model — token=None is safe, it just uses unauthenticated access
model = CLIPModel.from_pretrained(MODEL_ID, token=HF_TOKEN if HF_TOKEN else None).to(device)
processor = CLIPProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN if HF_TOKEN else None)
print(f"[AI-SERVICE] [OK] Model loaded successfully on {device}")


# ══════════════════════════════════════════════════════════════════════
# LABEL DEFINITIONS
# ══════════════════════════════════════════════════════════════════════
ISSUE_LABELS = [
    "a photo of an accident scene",
    "structural damage or collapsed building",
    "flooded street or natural disaster",
    "person in physical distress or medical emergency",
    "wildfire or urban smoke",
]

RELIEF_LABELS = [
    "humanitarian food aid distribution",
    "rescue workers extracting a person",
    "medical professional treating a patient",
    "repaired bridge or infrastructure",
    "emergency vehicle with lights on",
]

NEGATIVE_LABELS = [
    "a peaceful park",
    "a clean city street",
    "smiling people in an office",
    "commercial advertisement",
    "a random irrelevant photo",
    "a blank white image",
    "a selfie or portrait",
]

# Build the lookup map
LABEL_MAP = {}
for label in ISSUE_LABELS:
    LABEL_MAP[label] = "ISSUE_REGISTRATION"
for label in RELIEF_LABELS:
    LABEL_MAP[label] = "PROOF_OF_RELIEF"
for label in NEGATIVE_LABELS:
    LABEL_MAP[label] = "INVALID"

ALL_LABELS = list(LABEL_MAP.keys())


# ══════════════════════════════════════════════════════════════════════
# HEALTH CHECK & ROOT
# ══════════════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return {"message": "SevaSetu AI Service is running", "docs_url": "/docs"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": MODEL_ID, "device": device}


# ══════════════════════════════════════════════════════════════════════
# IMAGE VERIFICATION ENDPOINT
# ══════════════════════════════════════════════════════════════════════
@app.post("/verify-image")
async def verify_image(
    file: UploadFile = File(...),
    # Accept BOTH field names so it works from needs.js AND tasks.js
    upload_type: Optional[str] = Form(None),
    need_type: Optional[str] = Form(None),
    issue_title: Optional[str] = Form(None),
):
    """
    Accepts an image and classifies it as ISSUE_REGISTRATION, PROOF_OF_RELIEF, or INVALID.
    
    - For issue registration: expects photos of disasters, damage, emergencies
    - For proof of relief: expects photos of rescue, aid distribution, medical help
    - Returns is_verified=True/False with the reason
    """
    # Merge the two possible field names into one
    requested_type = upload_type or need_type

    try:
        # ── Read and validate image ──────────────────────────────
        image_data = await file.read()
        
        if len(image_data) < 100:
            return {
                "is_verified": False,
                "reason": "The uploaded file is empty or too small to be a valid image.",
                "detected_type": "INVALID",
                "top_match": "empty file",
                "similarity": 0.0,
            }

        try:
            image = Image.open(io.BytesIO(image_data)).convert("RGB")
        except Exception:
            return {
                "is_verified": False,
                "reason": "Could not open the file as an image. Please upload a valid JPG or PNG photo.",
                "detected_type": "INVALID",
                "top_match": "corrupted file",
                "similarity": 0.0,
            }

        # ── Setup Dynamic Labels ─────────────────────────────────
        dynamic_labels = ALL_LABELS.copy()
        custom_label_map = LABEL_MAP.copy()
        
        if issue_title:
            title_lower = issue_title.lower()
            if requested_type == "ISSUE_REGISTRATION":
                custom_issue = f"a photo showing the incident or disaster: {title_lower}"
                dynamic_labels.append(custom_issue)
                custom_label_map[custom_issue] = "ISSUE_REGISTRATION"
            elif requested_type == "PROOF_OF_RELIEF":
                custom_relief = f"a photo showing rescue operation or relief work for: {title_lower}"
                dynamic_labels.append(custom_relief)
                custom_label_map[custom_relief] = "PROOF_OF_RELIEF"

        # ── Run CLIP inference ───────────────────────────────────
        inputs = processor(  # type: ignore[call-arg]
            text=dynamic_labels,
            images=image,
            return_tensors="pt",  # type: ignore[arg-type]
            padding=True,  # type: ignore[arg-type]
        ).to(device)

        with torch.no_grad():
            outputs = model(**inputs)

        # Calculate cosine similarities
        image_embeds = outputs.image_embeds
        text_embeds = outputs.text_embeds
        image_embeds = image_embeds / image_embeds.norm(p=2, dim=-1, keepdim=True)
        text_embeds = text_embeds / text_embeds.norm(p=2, dim=-1, keepdim=True)
        cosine_similarities = torch.matmul(image_embeds, text_embeds.t())[0]

        # Build sorted results
        sim_results = []
        for i, label in enumerate(dynamic_labels):
            sim_results.append({
                "label": label,
                "category": custom_label_map[label],
                "similarity": round(float(cosine_similarities[i]), 4),
            })
        sim_results.sort(key=lambda x: x["similarity"], reverse=True)

        top = sim_results[0]
        detected_category = top["category"]

        print(f"[AI-SERVICE] Image analyzed → Top: \"{top['label']}\" ({top['similarity']:.3f}) | Category: {detected_category}")

        # ── Decision Logic ───────────────────────────────────────

        # 1. If the top match is INVALID or below threshold → reject
        if detected_category == "INVALID" or top["similarity"] < 0.25:
            print(f"[AI-SERVICE] [REJECTED]: Invalid or low confidence ({top['similarity']:.3f})")
            return {
                "is_verified": False,
                "reason": f"The image does not appear to show a valid disaster or relief scenario. AI detected: \"{top['label']}\" (confidence: {top['similarity']:.1%})",
                "detected_type": detected_category,
                "top_match": top["label"],
                "similarity": top["similarity"],
                "all_results": sim_results[:5],
            }

        # 2. If a specific type was requested, check it matches
        if requested_type:
            # Map common need_type values to our categories
            issue_keywords = ["flood", "fire", "medical", "shelter", "food", "water", "rescue", "earthquake", "storm"]
            is_issue_type = any(kw in requested_type.lower() for kw in issue_keywords)
            
            # If the request is for proof of relief but we detected an issue (or vice versa)
            if requested_type == "PROOF_OF_RELIEF" and detected_category != "PROOF_OF_RELIEF":
                print(f"[AI-SERVICE] [MISMATCH]: Expected PROOF_OF_RELIEF, got {detected_category}")
                return {
                    "is_verified": False,
                    "reason": f"This image shows a disaster/incident scene, but proof of relief work (rescue, aid, treatment) is required. AI detected: \"{top['label']}\"",
                    "detected_type": detected_category,
                    "top_match": top["label"],
                    "similarity": top["similarity"],
                    "all_results": sim_results[:5],
                }
            elif requested_type == "ISSUE_REGISTRATION" and detected_category != "ISSUE_REGISTRATION":
                print(f"[AI-SERVICE] [MISMATCH]: Expected ISSUE_REGISTRATION, got {detected_category}")
                return {
                    "is_verified": False,
                    "reason": f"This image does not show a disaster or emergency incident. AI detected: \"{top['label']}\"",
                    "detected_type": detected_category,
                    "top_match": top["label"],
                    "similarity": top["similarity"],
                    "all_results": sim_results[:5],
                }

        # 3. Image is valid!
        print(f"[AI-SERVICE] [VERIFIED]: {detected_category} — \"{top['label']}\" ({top['similarity']:.3f})")
        return {
            "is_verified": True,
            "detected_type": detected_category,
            "top_match": top["label"],
            "similarity": top["similarity"],
            "all_results": sim_results[:5],
        }

    except Exception as e:
        print(f"[AI-SERVICE] [CRASH]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════
# NLP EXTRACTION ENDPOINT
# ══════════════════════════════════════════════════════════════════════
@app.post("/extract-facts")
async def extract_facts(req: FactExtractionRequest):
    """
    Takes a voice transcript and extracts structured JSON EmergencyFacts using Qwen-based NLP.
    """
    try:
        print(f"[AI-SERVICE] Extracting facts for transcript: '{req.transcript}'")
        result = nlp_module.extract_facts(req.transcript)
        return result
    except Exception as e:
        print(f"[AI-SERVICE] [NLP CRASH]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════
# AUDIO TRANSCRIPTION ENDPOINT (Local Whisper STT + Gemini Fallback)
# ══════════════════════════════════════════════════════════════════════
import base64
import tempfile

# Configure CPU threading for minimum inference latency
if hasattr(torch, 'set_num_threads'):
    torch.set_num_threads(max(1, min(4, (os.cpu_count() or 4))))

print("[AI-SERVICE] Loading local Whisper 'base.en' model...")
try:
    whisper_model = whisper.load_model('base.en')
    print("[AI-SERVICE] [OK] Local Whisper base.en English STT model loaded successfully")
except Exception as e:
    try:
        whisper_model = whisper.load_model('tiny.en')
        print("[AI-SERVICE] [OK] Local Whisper tiny.en English STT model loaded successfully")
    except Exception as e2:
        whisper_model = None
        print(f"[AI-SERVICE] [WARNING] Could not load local Whisper: {e2}")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file (16kHz 16-bit mono WAV) and
    returns a text transcription using local Whisper STT (instant, offline).
    Forces English decoding with beam_size=5, temperature=0.0, and domain prompt.
    """
    audio_data = await file.read()
    if len(audio_data) < 500:
        return {"text": "", "error": "Audio too short"}

    # 1. Primary: Local Whisper (offline, deterministic, high-accuracy base.en)
    if whisper_model is not None:
        try:
            suffix = ".wav"
            if file.filename and file.filename.endswith(".webm"):
                suffix = ".webm"
            elif file.filename and file.filename.endswith(".ogg"):
                suffix = ".ogg"

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_data)
                tmp_path = tmp.name

            try:
                result = whisper_model.transcribe(
                    tmp_path,
                    language="en",
                    beam_size=1,
                    best_of=1,
                    temperature=0.0,
                    condition_on_previous_text=False,
                    initial_prompt="Emergency disaster relief fire accident trapped injured medical help flood rescue SevaSetu",
                    fp16=False
                )
                transcript = (result.get("text") or "").strip()
                # Clean up artifacts
                if transcript.lower() in ("", ".", "silence", "no speech", "unintelligible", "inaudible", "thank you", "thanks for watching", "subtitles by"):
                    transcript = ""
                print(f"[AI-SERVICE] Whisper transcribed ({len(audio_data)} bytes): '{transcript}'")
                return {"text": transcript, "engine": "local-whisper"}
            finally:
                if os.path.exists(tmp_path):
                    try: os.remove(tmp_path)
                    except: pass
        except Exception as e:
            print(f"[AI-SERVICE] Whisper error: {e}. Falling back to Gemini...")

    # 2. Fallback: Gemini cloud API
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        server_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', '.env')
        if os.path.exists(server_env):
            with open(server_env, 'r') as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        api_key = line.split("=", 1)[1].strip('"').strip("'")
                        break

    if api_key:
        try:
            content_type = file.content_type or "audio/webm"
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{
                    "parts": [
                        {"inlineData": {"mimeType": content_type, "data": audio_b64}},
                        {"text": "Transcribe this audio exactly as spoken. Return ONLY the raw transcription text, nothing else."}
                    ]
                }],
                "generationConfig": {"temperature": 0.0}
            }
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                return {"text": text, "engine": "gemini-cloud"}
        except Exception as e:
            print(f"[AI-SERVICE] Gemini transcribe fallback error: {e}")

    return {"text": "", "error": "Transcription failed"}


# ══════════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AI_PORT", "8000"))
    print(f"[AI-SERVICE] Starting on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)

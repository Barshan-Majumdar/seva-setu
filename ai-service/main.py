from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import io
from typing import Optional

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Model
MODEL_ID = "openai/clip-vit-base-patch32"
print(f"Loading model {MODEL_ID}...")
model = CLIPModel.from_pretrained(MODEL_ID)
processor = CLIPProcessor.from_pretrained(MODEL_ID)
print("Model loaded successfully.")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": MODEL_ID}

@app.post("/verify-image")
async def verify_image(
    file: UploadFile = File(...),
    need_type: Optional[str] = Form(None)
):
    try:
        # Read image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Base labels for general disaster detection + Anti-Fraud labels
        labels = [
            "a photo of a natural disaster",
            "a photo of people needing help",
            "a photo of a destroyed building",
            "a normal photo with no disaster",
            "a selfie or portrait",
            "a random irrelevant photo",
            "a completely black image",
            "a blank white image",
            "a dark screen",
            "a photo of a computer screen"
        ]

        # Add specific labels based on the reported need_type
        if need_type == "medical":
            labels.extend(["a photo of a medical emergency", "a photo of injured people", "a photo of an ambulance or hospital"])
        elif need_type == "accidental":
            labels.extend(["a photo of a vehicle accident", "a photo of a crash", "a photo of an accident scene"])
        elif need_type == "food":
            labels.extend(["a photo of people starving", "a photo of food distribution", "a photo of famine or lack of food"])
        elif need_type == "shelter":
            labels.extend(["a photo of homeless people", "a photo of a refugee camp", "a photo of ruined houses"])
        elif need_type == "rescue":
            labels.extend(["a photo of a rescue operation", "a photo of people trapped", "a photo of a flood rescue"])

        # Prepare inputs
        inputs = processor(
            text=labels, 
            images=image, 
            return_tensors="pt", 
            padding=True
        )

        # Inference
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1)
        
        # Get results
        results = []
        for i, label in enumerate(labels):
            results.append({
                "label": label,
                "confidence": float(probs[0][i])
            })
            
        # Sort by confidence
        results = sorted(results, key=lambda x: x["confidence"], reverse=True)
        top_result = results[0]
        
        # Stricter check: 
        # 1. Must not be a "normal" or "irrelevant" photo
        # 2. Must meet higher confidence threshold (0.45)
        invalid_labels = [
            "a normal photo with no disaster", 
            "a selfie or portrait", 
            "a random irrelevant photo",
            "a completely black image",
            "a blank white image",
            "a dark screen",
            "a photo of a computer screen"
        ]
        
        is_valid_disaster = top_result["label"] not in invalid_labels and top_result["confidence"] > 0.45

        # Boost confidence if it strictly matches the requested need_type
        matches_need = False
        if need_type and is_valid_disaster:
            top_three_labels = [r["label"] for r in results[:3]]
            if need_type == "medical" and any("medical" in l or "injured" in l or "ambulance" in l for l in top_three_labels): matches_need = True
            elif need_type == "accidental" and any("accident" in l or "crash" in l for l in top_three_labels): matches_need = True
            elif need_type == "food" and any("food" in l or "starving" in l for l in top_three_labels): matches_need = True
            elif need_type == "shelter" and any("homeless" in l or "camp" in l or "ruined" in l for l in top_three_labels): matches_need = True
            elif need_type == "rescue" and any("rescue" in l or "trapped" in l for l in top_three_labels): matches_need = True
            elif need_type == "other": matches_need = True
            
            if not matches_need and need_type != "other":
                is_valid_disaster = False

        return {
            "is_verified": is_valid_disaster,
            "top_match": top_result["label"],
            "confidence": top_result["confidence"],
            "matches_specific_need": matches_need,
            "all_results": results[:5]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

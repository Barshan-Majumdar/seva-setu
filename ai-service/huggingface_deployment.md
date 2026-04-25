# 🚀 Hugging Face Deployment Plan for SevaSetu AI Service

This plan outlines the steps to deploy the SevaSetu AI verification service on Hugging Face Spaces. This platform provides **16GB of RAM** for free, which is ideal for the `torch` and `transformers` libraries used by the model.

---

## 1. Preparation
Ensure you have the following 3 files ready in your `ai-service` folder:
- `main.py` (The FastAPI application)
- `requirements.txt` (The list of dependencies)
- `Dockerfile` (The configuration I just created for you)

---

## 2. Create the Space
1. Login to [Hugging Face](https://huggingface.co/).
2. Click on your profile picture (top right) and select **"New Space"**.
3. Fill in the details:
   - **Space Name:** `seva-setu-ai` (or similar)
   - **License:** `MIT` (or your choice)
   - **Select the Space SDK:** Choose **Docker**.
   - **Choose a Docker template:** Select **Blank**.
   - **Space Hardware:** Keep the default **"Free: 2 vCPU · 16GB · No GPU"**.
4. Click **"Create Space"**.

---

## 3. Upload the Code
1. Once the Space is created, go to the **"Files and versions"** tab.
2. Click **"Add file"** -> **"Upload files"**.
3. Drag and drop your **3 files** (`main.py`, `requirements.txt`, `Dockerfile`).
4. Add a commit message (e.g., "Initial deployment") and click **"Commit changes to main"**.

---

## 4. Monitor the Build
1. Go to the **"App"** tab at the top of the page.
2. You will see a "Building" status. Hugging Face is currently installing Python, Torch, and your other dependencies.
3. This process takes about **3–5 minutes**.
4. Once finished, the status will change to **"Running"**.

---

## 5. Verify the API
1. Your API is now live at:
   `https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space`
2. You can test it by adding `/docs` to the end of the URL to see the Swagger documentation (e.g., `https://barshan-seva-setu-ai.hf.space/docs`).

---

## 6. Update the Backend
Finally, update your **Backend server's `.env` file** so it knows where to send images for verification:

```env
# In c:\Users\BARSHAN MAJUMDAR\Downloads\seva-setu\server\.env
AI_SERVICE_URL=https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space
```

---

## 💡 Important Notes
- **Cold Starts:** If the Space isn't used for a few hours, it may go to "Sleep." The first request sent after it sleeps will take a few seconds longer while it wakes up.
- **Privacy:** If you want the URL to be hidden, you can set the Space visibility to **Private**, but then you would need to handle Hugging Face Access Tokens in your backend. For now, **Public** is the easiest way to start.

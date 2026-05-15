<!-- ═══════════════════ ANIMATED HEADER BANNER ═══════════════════ -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a472a,50:2d6148,100:4ade80&height=220&section=header&text=SevaSetu&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=AI-Driven+Disaster+Response+and+Humanitarian+Logistics&descSize=20&descAlignY=55&descAlign=50" width="100%" alt="SevaSetu Banner" />
</p>

<!-- ═══════════════════ ANIMATED TYPING SVG ═══════════════════ -->
<p align="center" style="margin-top:-15px">
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=16&duration=3000&pause=1000&color=58A6FF&center=true&vCenter=true&repeat=true&width=650&height=100&lines=Eliminating+%22Information+Chaos%22+in+Disaster+Management;Connecting+Distress+Signals+with+Verified+Relief;Powered+by+CLIP+Vision+AI+%2B+Geo-Spatial+Math" alt="Typing SVG" />
  </a>
</p>

<!-- ═══════════════════ ANIMATED TECH BADGES ═══════════════════ -->
<p align="center">
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-PostGIS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostGIS" /></a>
</p>
<p align="center">
  <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://openai.com/research/clip"><img src="https://img.shields.io/badge/CLIP-ViT--L%2F14-FFD700?style=for-the-badge&logo=openai&logoColor=black" alt="CLIP" /></a>
  <a href="https://clerk.com"><img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" /></a>
  <a href="https://www.twilio.com"><img src="https://img.shields.io/badge/Twilio-WhatsApp-F22F46?style=for-the-badge&logo=twilio&logoColor=white" alt="Twilio" /></a>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 📑 Table of Contents

- [The Problem](#-the-problem)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🔥 The Problem

Traditional disaster response is plagued by **unverified data**. When a flood hits, thousands of reports flood in — many are duplicates, some are fake, and others are outdated. Response teams waste critical hours manually triaging this chaos.

**SevaSetu solves this by:**

| Challenge | SevaSetu's Solution |
|---|---|
| Fake or outdated reports | Mandatory **GPS-locked**, live-captured imagery with EXIF verification |
| Unverified distress claims | **CLIP Neural Model** cross-validates visual evidence against disaster categories |
| Slow volunteer dispatch | **Automated proximity broadcast** to all volunteers within a 6 km radius |
| Lack of accountability | **Proof-of-Work** system requiring geo-tagged completion photos |
| Zero-connectivity zones | **Offline-first PWA** with IndexedDB queuing and auto-sync |

> By turning "Information Chaos" into "Actionable Intelligence," we save the most valuable resource in any disaster: **Time.**

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## ✨ Key Features

### 🛡️ AI Verification Pipeline
Every disaster report and task completion is cross-verified using a **dual-engine** approach:
- **EXIF Geo-spatial metadata validation** — ensures photos are live-captured, not uploaded from gallery
- **CLIP-based Semantic Vision AI** (`openai/clip-vit-large-patch14`) — mathematically compares image vectors against disaster category labels

### 📡 Automated Volunteer Dispatch
- **Broadcast Dispatch** system identifies and alerts all available volunteers within a configurable radius (default 6 km)
- **Re-broadcast cron job** automatically re-notifies if initial broadcasts expire without acceptance
- Volunteers scored on **Proximity (50%) + Skill Match (30%) + Reliability (20%)**

### 🔐 Biometric-Equivalent Trust
- "Proof of Work" system requiring **live-captured, geo-tagged imagery** to prevent fraud
- Check-in location validation ensures volunteers are physically at the disaster site
- AI re-verifies completion images for relief evidence

### 🗺️ Command Center Dashboard
- Real-time **Kanban board** with drag-and-drop triage for coordinators
- Automated **Urgency Scoring** (1–10 scale) based on disaster type, population density, and verification status
- Interactive **Leaflet heatmaps** visualizing disaster clusters and resource needs

### 💓 Continuous Volunteer Tracking
- Real-time location updates via GPS heartbeat
- Automatic **offline detection** marks inactive volunteers to maintain dispatch accuracy

### 📱 Multi-Channel Access
- **PWA** with offline-first resilience (IndexedDB queuing)
- **WhatsApp Reporting Bot** (Twilio-powered) — report distress without installing the app
- **SevaBot** — role-aware AI chatbot powered by Gemini 2.5 Flash

### 👥 Multi-Role Ecosystem
| Role | Workspace | Capabilities |
|---|---|---|
| **Civilian** | `/field`, `/user-dashboard` | Report needs, track status, view impact stats |
| **Volunteer** | `/volunteer` | Accept missions, submit proof, track assignments |
| **Coordinator** | `/dashboard` | Triage needs, dispatch volunteers, approve applications |

### 🔒 Trust-Gated Approvals
Rigorous vetting system for volunteers requiring manual coordinator review and identity proofing before mission access.

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 19 + Vite)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Landing  │  │  Field   │  │Volunteer │  │Dashboard │              │
│  │  Page    │  │ Terminal │  │ Mission  │  │ War Room │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │              │                 │
│       └──────────────┴──────────────┴──────────────┘                 │
│                              │                                       │
│              ┌───────────────┤  Clerk Auth + Axios                   │
│              │  IndexedDB    │  (Offline Queue)                      │
└──────────────┴───────────────┴───────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   BACKEND (Express)  │
                    │   ┌──────────────┐   │
                    │   │  Auth (Clerk │   │
                    │   │  + JWT + LRU)│   │
                    │   ├──────────────┤   │
                    │   │  Routes:     │   │
                    │   │  needs/tasks │   │
                    │   │  volunteers  │   │
                    │   │  chat/whatsapp│  │
                    │   ├──────────────┤   │
                    │   │  Services:   │   │
                    │   │  Matching    │   │
                    │   │  Scoring     │   │
                    │   │  Broadcast   │   │
                    │   ├──────────────┤   │
                    │   │  BullMQ      │   │
                    │   │  Workers     │   │
                    │   └──────┬───────┘   │
                    └──────────┼───────────┘
                       ┌───────┼────────┐
                       ▼       ▼        ▼
              ┌─────────┐ ┌────────┐ ┌──────────────┐
              │PostgreSQL│ │ Redis  │ │  AI Service │
              │ + PostGIS│ │(Queue +│ │  (FastAPI)  │
              │  (Neon)  │ │ Cache) │ │  CLIP ViT-L │
              └─────────┘ └────────┘ └──────────────┘
```

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🧰 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework with lazy-loaded routes |
| **Vite 8** | Lightning-fast build tooling |
| **Tailwind CSS 4** | Utility-first styling |
| **Framer Motion** | Smooth animations & transitions |
| **Leaflet + Mapbox GL** | Interactive maps & heatmaps |
| **Clerk** | Authentication (OAuth, SSO) |
| **Lucide React** | Icon library |
| **exifr / piexifjs** | Client-side EXIF metadata extraction |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 20 + Express** | REST API server |
| **Prisma ORM** | Type-safe database client |
| **PostgreSQL + PostGIS** | Geo-spatial queries (`ST_Distance`, `ST_DWithin`) |
| **Redis + BullMQ** | Job queues & rate-limit caching |
| **Clerk Backend SDK** | Session token verification |
| **Twilio** | WhatsApp bot integration |
| **Google Gemini 2.5 Flash** | SevaBot AI chatbot engine |
| **ImageKit** | Cloud image storage |
| **Tesseract.js** | OCR for document verification |

### AI Service
| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance Python API |
| **OpenAI CLIP ViT-L/14** | Zero-shot image classification |
| **PyTorch** | Neural network inference |
| **Transformers (HuggingFace)** | Model loading & processing |

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 📂 Project Structure

```
seva-setu/
├── client/                          # React Frontend (Vite + Tailwind)
│   ├── public/                      # Static assets, PWA manifest, favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── landing/             # Hero, Problem, Roles, Trust sections
│   │   │   ├── dashboard/           # Kanban, Heatmap, Filters, Metrics
│   │   │   ├── CameraWatermark.jsx  # GPS-stamped live camera capture
│   │   │   ├── ChatWidget.jsx       # SevaBot AI companion
│   │   │   ├── BroadcastAlert.jsx   # Real-time volunteer notifications
│   │   │   ├── VolunteerTaskMap.jsx  # Mission map with routing
│   │   │   └── ProtectedRoute.jsx   # Role-based route guards
│   │   ├── pages/
│   │   │   ├── FieldForm.jsx        # Distress report submission
│   │   │   ├── VolunteerPage.jsx    # Volunteer mission control
│   │   │   ├── DashboardPage.jsx    # Coordinator war room
│   │   │   └── UserDashboardPage.jsx# Civilian impact tracker
│   │   ├── services/                # API client, offline queue, dashboard
│   │   ├── hooks/                   # Custom React hooks (useAuth, etc.)
│   │   ├── context/                 # React context providers
│   │   └── utils/                   # EXIF manipulation & spatial math
│   ├── vercel.json                  # SPA routing config
│   └── package.json
│
├── server/                          # Node.js API (Express)
│   ├── prisma/
│   │   ├── schema.prisma            # 9 models with PostGIS geometry
│   │   ├── migrations/              # SQL migrations
│   │   └── seed.js                  # Database seeder
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js              # Register, login, session mgmt
│   │   │   ├── needs.js             # CRUD + heatmap + AI verification
│   │   │   ├── tasks.js             # Assignment, check-in, completion
│   │   │   ├── volunteers.js        # GPS heartbeat, availability toggle
│   │   │   ├── volunteerRequests.js # Application & vetting workflow
│   │   │   ├── coordinators.js      # Admin management endpoints
│   │   │   ├── chat.js              # Gemini-powered SevaBot
│   │   │   └── whatsapp.js          # Twilio webhook handler
│   │   ├── services/
│   │   │   ├── matchingService.js   # Proximity + skill + reliability scoring
│   │   │   ├── scoringService.js    # Multi-factor urgency calculator
│   │   │   ├── chatService.js       # Gemini AI context builder
│   │   │   └── clerkService.js      # Clerk identity bridge
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT + Clerk + LRU cache layer
│   │   │   └── rateLimiter.js       # Redis-backed rate limiting
│   │   ├── workers/
│   │   │   └── aiWorker.js          # BullMQ background AI verification
│   │   └── jobs/
│   │       └── reBroadcast.js       # Cron: re-dispatch expired broadcasts
│   └── package.json
│
├── ai-service/                      # FastAPI ML Microservice
│   ├── main.py                      # CLIP model + /verify-image endpoint
│   ├── requirements.txt             # PyTorch, Transformers, FastAPI
│   ├── Dockerfile                   # HuggingFace Spaces deployment
│   └── huggingface_deployment.md    # Step-by-step deployment guide
│
├── docker-compose.yml               # Local PostGIS database
├── LICENSE                          # MIT License
└── .gitignore
```

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 20.x | Backend & frontend runtime |
| **Python** | 3.10+ | AI service runtime |
| **Docker** | Latest | Local PostgreSQL + PostGIS |
| **Redis** | 7+ | Job queues & rate limiting |
| **Git** | Latest | Version control |

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/seva-setu.git
cd seva-setu
```

### 2️⃣ Start the Database

```bash
docker-compose up -d
```

This spins up a **PostGIS-enabled PostgreSQL 15** container on port `5432`.

### 3️⃣ Set Up the Backend

```bash
cd server
npm install
cp .env.example .env          # Edit with your credentials
npx prisma migrate dev         # Run database migrations
npx prisma db seed             # Seed initial data (optional)
npm run dev                    # Start on http://localhost:5000
```

### 4️⃣ Set Up the Frontend

```bash
cd client
npm install
cp .env.example .env           # Set VITE_CLERK_PUBLISHABLE_KEY, etc.
npm run dev                    # Start on http://localhost:5173
```

### 5️⃣ Set Up the AI Service

```bash
cd ai-service
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py                 # Start on http://localhost:8000
```

> **Note:** First launch downloads the CLIP ViT-L/14 model (~900 MB). Subsequent starts are instant.

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🔑 Environment Variables

### Server (`server/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/sevasetu` |
| `JWT_SECRET` | JWT signing secret | `your_super_secret_key` |
| `CLERK_SECRET_KEY` | Clerk backend secret | `sk_test_...` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `...` |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp number | `whatsapp:+14155238886` |
| `AI_SERVICE_URL` | AI microservice URL | `http://localhost:8000` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `HF_TOKEN` | HuggingFace access token | `hf_...` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key | `private_...` |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint | `https://ik.imagekit.io/...` |
| `CRON_SECRET` | External cron job auth | Any strong secret |

### Client (`client/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | `pk_test_...` |
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:5000/api` |
| `VITE_TWILIO_WHATSAPP_NUMBER` | WhatsApp sandbox number | `+14155238886` |
| `VITE_TWILIO_SANDBOX_CODE` | Sandbox join code | `join ...` |

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 📡 API Reference

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | User registration | Public |
| `POST` | `/api/auth/login` | Session creation (JWT) | Public |
| `GET` | `/api/auth/me` | Get current user & role | 🔒 |

### Disaster Needs
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/needs` | Submit report (image + GPS) | 🔒 |
| `GET` | `/api/needs` | List all reports (filtered) | 🔒 |
| `PATCH` | `/api/needs/:id/status` | Triage & approve | 🔒 Coordinator |
| `GET` | `/api/needs/heatmap` | Geo-spatial cluster data | 🔒 |

### Volunteer Operations
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `PATCH` | `/api/volunteers/me/location` | GPS heartbeat update | 🔒 Volunteer |
| `PATCH` | `/api/volunteers/me/availability` | Toggle field readiness | 🔒 Volunteer |
| `POST` | `/api/volunteer-requests` | Apply to become volunteer | 🔒 |
| `PATCH` | `/api/tasks/:id/complete` | Submit Proof of Work | 🔒 Volunteer |

### Task Management
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/tasks/my` | Get assigned tasks | 🔒 Volunteer |
| `GET` | `/api/tasks/my-broadcasts` | Get broadcast notifications | 🔒 Volunteer |

### AI & Chat
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/chat` | SevaBot AI (Gemini 2.5 Flash) | 🔒 |
| `POST` | `/verify-image` | CLIP image verification | AI Service |

### WhatsApp Bot
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/whatsapp/webhook` | Twilio incoming webhook | Twilio |

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## ☁️ Deployment

### Frontend → Vercel
```bash
cd client
npx vercel --prod
```
The `vercel.json` handles SPA routing automatically.

### Backend → Render / Railway
Deploy the `server/` directory with:
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Node Version:** `20.x`

### AI Service → HuggingFace Spaces
1. Create a new **Docker Space** on [HuggingFace](https://huggingface.co/new-space)
2. Upload `main.py`, `requirements.txt`, and `Dockerfile`
3. The free tier provides **16 GB RAM** — sufficient for CLIP ViT-L/14

> See [`ai-service/huggingface_deployment.md`](ai-service/huggingface_deployment.md) for the full step-by-step guide.

### Database → Neon
Use [Neon](https://neon.tech) for serverless PostgreSQL with PostGIS extension enabled.

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

Please ensure your code follows the existing patterns and includes appropriate documentation.

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License · Copyright (c) 2026 SevaSetu Team
```

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

## 🙏 Acknowledgements

Thank you for visiting the SevaSetu project. We sincerely appreciate you taking your precious time to explore our vision for a more resilient and transparent disaster response system.

Our team is dedicated to pushing the boundaries of what technology can do for humanity. Whether you are a developer, a disaster management professional, or a curious visitor, your interest means a lot to us.

**Thank you for your time and for standing with us in our mission.**

<!-- ═══════════════════ WAVE DIVIDER ═══════════════════ -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=14&height=1" width="100%" alt="divider" />

<p align="center">
  <em>Developed with a focus on mathematical integrity and humanitarian impact.</em>
</p>

<p align="center">
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=16&duration=4000&pause=2000&color=2D6148&center=true&vCenter=true&repeat=true&width=500&lines=Warm+Regards+from+Team+PiroCoders+%F0%9F%92%9A;Thank+you+for+standing+with+our+mission+%F0%9F%8C%8D;Star+%E2%AD%90+if+this+inspired+you!" alt="Typing SVG" />
  </a>
</p>

<!-- ═══════════════════ ANIMATED FOOTER BANNER ═══════════════════ -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a472a,50:2d6148,100:4ade80&height=120&section=footer&animation=fadeIn" width="100%" alt="Footer" />
</p>

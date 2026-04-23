# 🌉 SevaSetu — Implementation PRD
> *Real-time Volunteer Coordination & Community Needs Intelligence Platform*

---

## 📋 Overview

| Field | Detail |
|---|---|
| **Product Name** | SevaSetu |
| **Type** | Web Platform (PWA) |
| **Target Users** | NGO Coordinators, Volunteers, Field Workers |
| **Core Stack** | React + Tailwind, Node.js (Express) + Prisma ORM, PostgreSQL + PostGIS |
| **Timeline** | 3–7 Days (Hackathon Sprint) |

---

## 🗂️ Phase 0 — Project Setup & Repository

### 0.1 Initialize Repository
- [x] Create a GitHub repository named `sevasetu`
- [x] Add a root-level `README.md` with project description and setup steps
- [x] Add `.gitignore` for Node, Python, and environment files
- [x] Create a `LICENSE` file (MIT)

### 0.2 Define Monorepo Folder Structure
- [x] Create `/client` folder for the React frontend
- [x] Create `/server` folder for the backend API
- [x] Create `/docs` folder for wireframes, ERDs, and pitch assets
- [x] Create `docker-compose.yml` at root (optional but recommended for local DB)

### 0.3 Environment Configuration
- [x] Create `.env.example` files in both `/client` and `/server`
- [x] Document required env variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `MAPBOX_TOKEN` (or Leaflet, no key needed)
- [x] Add `.env` to `.gitignore`

### 0.4 Team Coordination
- [x] Assign GitHub usernames and roles to each team member
- [x] Create a shared task board (GitHub Projects, Notion, or Linear)
- [x] Do a 15-min kickoff call to align on API contracts between frontend and backend

---

## 🗄️ Phase 1 — Database Design & Setup

### 1.1 Choose & Provision Database
- [x] Install PostgreSQL locally (or spin up via `docker-compose`)
- [x] Install the **PostGIS** extension: `CREATE EXTENSION postgis;`
- [x] Confirm connection works with a test query

### 1.2 Design the Schema — Core Tables

#### `users` table
- [x] Define fields: `id`, `name`, `email`, `password_hash`, `role` (ENUM: `coordinator`, `volunteer`, `field_worker`), `created_at`
- [x] Add unique constraint on `email`

#### `volunteers` table (extends users)
- [x] Define fields: `user_id` (FK), `skills` (TEXT[] array: e.g., `['medical', 'logistics', 'counseling']`), `location` (PostGIS `POINT`), `is_available` (BOOLEAN), `tasks_completed` (INT), `completion_rate` (FLOAT)
- [x] Add spatial index: `CREATE INDEX ON volunteers USING GIST(location);`

#### `needs` table
- [x] Define fields: `id`, `title`, `description`, `need_type` (ENUM: `medical`, `food`, `shelter`, `education`, `other`), `location` (PostGIS `POINT`), `ward`, `district`, `people_affected` (INT), `urgency_score` (FLOAT 1–10), `status` (ENUM: `open`, `assigned`, `in_progress`, `completed`), `is_disaster_zone` (BOOLEAN), `reported_by` (FK → users), `created_at`, `updated_at`
- [x] Add spatial index on `location`

#### `tasks` table
- [x] Define fields: `id`, `need_id` (FK), `assigned_volunteer_id` (FK → users), `assigned_at`, `checked_in_at`, `completed_at`, `status` (mirrors need status), `notes`

#### `organizations` table
- [x] Define fields: `id`, `name`, `contact_email`, `district`, `created_at`
- [x] Link `users` to `organizations` via `org_id` FK

### 1.3 Write Schema & Migrations
- [x] Use **Prisma ORM** with `prisma/schema.prisma` for schema definition
- [x] Define all models: `Organization`, `User`, `Volunteer`, `Need`, `Task`
- [x] Define enums: `UserRole`, `NeedType`, `NeedStatus`, `TaskStatus`
- [x] Add PostGIS extension support via `extensions = [postgis]`
- [x] Create raw SQL migration for PostGIS geometry columns & GIST indexes (`prisma/migrations/0_init/migration.sql`)
- [ ] Run all migrations and verify tables exist: `\dt` in psql

### 1.4 Seed Data
- [x] Create a Prisma seed script (`prisma/seed.js`) with at least:
  - 1 coordinator account
  - 10 volunteer accounts with varied skills and geo-locations around a sample city (e.g., Kolkata)
  - 15–20 sample `needs` records across different wards with varied urgency levels
  - 5 tasks in various statuses
- [ ] Run seed and verify data in DB: `npm run seed`


---

## 🔧 Phase 2 — Backend API Development

### 2.1 Project Bootstrap
- [x] Initialize project: `npm init` (Express) or `fastapi` scaffold (Python)
- [x] Install core dependencies:
  - Express: `express`, `pg`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`
  - Dev: `prisma`, `nodemon`
- [x] Set up a basic `health check` endpoint: `GET /api/health → { status: "ok" }`
- [x] Verify the server starts and the health check works

### 2.2 Authentication Module
- [x] Implement `POST /api/auth/register` — hash password, store user, return JWT
- [x] Implement `POST /api/auth/login` — verify credentials, return JWT + role
- [x] Create `authMiddleware` — validates JWT on protected routes
- [x] Test both endpoints with Postman or Thunder Client

### 2.3 Needs API
- [x] `POST /api/needs` — create a need (field worker / coordinator), trigger urgency scoring
- [x] `GET /api/needs` — list all needs (filterable by status, district, need_type, urgency)
- [x] `GET /api/needs/:id` — get single need with full details
- [x] `PATCH /api/needs/:id/status` — update status (coordinator only)
- [x] `GET /api/needs/heatmap` — return all needs with lat/lng + urgency_score for map rendering

### 2.4 Urgency Scoring Algorithm
> This is a core differentiator — implement it carefully.

- [x] Create a `scoringService.js` (or `scoring_service.py`) module
- [x] Implement base scoring formula:

```
urgency_score =
  (need_type_weight)           // medical=4, food=3, shelter=2, education=1
  + (people_affected / 50)     // capped at 3 points
  + (hours_since_reported / 6) // capped at 2 points
  + (is_disaster_zone ? 1 : 0) // bonus point
  → normalize to 1–10 scale
```

- [x] Add `disaster_mode` flag — if `true`, multiply urgency scores by 1.5 (capped at 10)
- [x] Call this service on every `POST /api/needs` and store the score
- [x] Write a cron job (or manual trigger) to **recalculate scores every hour** based on time elapsed
- [x] Write unit tests for the scoring function with edge cases

### 2.5 Volunteer Matching Algorithm
> This is the "Smart Dispatch" engine — your hackathon showpiece.

- [x] Create `matchingService.js` (or `matching_service.py`)
- [x] For a given `need_id`, implement composite scoring per volunteer:

```
match_score =
  (1 / geo_distance_km) * 40     // proximity weight: 40%
  + (skill_overlap_count) * 30   // skill match weight: 30%
  + (is_available ? 1 : 0) * 20  // availability weight: 20%
  + (completion_rate) * 10       // reliability weight: 10%
```

- [x] Use PostGIS `ST_Distance` for geo-distance queries:
  ```sql
  SELECT *, ST_Distance(location::geography, ST_MakePoint($lon, $lat)::geography) AS dist_m
  FROM volunteers WHERE is_available = true ORDER BY dist_m ASC LIMIT 10;
  ```
- [x] Return top 3 matched volunteers with their scores and distances
- [x] Implement `GET /api/needs/:id/matches` — returns ranked volunteer list

### 2.6 Tasks API
- [x] `POST /api/tasks` — assign a volunteer to a need (coordinator only), set status to `assigned`
- [x] `PATCH /api/tasks/:id/checkin` — volunteer GPS check-in, updates `checked_in_at` and status to `in_progress`
- [x] `PATCH /api/tasks/:id/complete` — volunteer marks task done, updates `completed_at`, increments `tasks_completed` on volunteer, recalculates `completion_rate`
- [x] `GET /api/tasks/my` — volunteer sees their own task list

### 2.7 Volunteers API
- [x] `GET /api/volunteers` — list all volunteers (coordinator view)
- [x] `PATCH /api/volunteers/me/availability` — toggle volunteer availability on/off
- [x] `PATCH /api/volunteers/me/location` — update volunteer's current GPS location
- [x] `GET /api/volunteers/me/stats` — return `tasks_completed`, `completion_rate`, active tasks

### 2.8 API Testing & Documentation
- [x] Test every endpoint with mock data
- [x] Write a simple `API.md` documenting all routes, request bodies, and response shapes
- [x] Add basic rate limiting middleware (optional but good for demo)

---

## 🎨 Phase 3 — Frontend Development

### 3.1 Project Bootstrap
- [ ] Scaffold with Vite: `npm create vite@latest client -- --template react`
- [ ] Install dependencies: `tailwindcss`, `react-router-dom`, `axios`, `leaflet`, `react-leaflet`, `lucide-react`
- [ ] Configure Tailwind CSS: `tailwind.config.js` + `@tailwind` directives in `index.css`
- [ ] Create folder structure:
  ```
  /src
    /components   → reusable UI pieces
    /pages        → route-level views
    /hooks        → custom React hooks
    /services     → axios API calls
    /context      → auth context
  ```
- [ ] Set up `react-router-dom` with routes for `/login`, `/dashboard`, `/volunteer`, `/field`
- [ ] Create `AuthContext` with login/logout/currentUser state

### 3.2 Auth Pages
- [ ] Build `LoginPage.jsx` — email + password form, role-based redirect on success
- [ ] Build `RegisterPage.jsx` — name, email, password, role selector, skills multi-select (for volunteers)
- [ ] Implement `ProtectedRoute` component — redirects to login if no JWT in localStorage
- [ ] Test login flow end-to-end with real backend

### 3.3 Field Worker Form (View 1)
> Ultra-simple. Low-bandwidth. Mobile-first.

- [ ] Build `FieldForm.jsx` page — full-screen, single-column form
- [ ] Add fields: Title, Description, Need Type (dropdown), Ward, District, People Affected, GPS auto-fill button
- [ ] Add GPS capture: `navigator.geolocation.getCurrentPosition()` → populates hidden lat/lng fields
- [ ] Implement **offline support with Service Worker**:
  - [ ] Create `public/sw.js` — cache form page and assets
  - [ ] Implement `IndexedDB` queue — if offline, store submission locally
  - [ ] On network restore, flush the queue and sync to backend
- [ ] Add a visual "Offline / Online" indicator badge
- [ ] Show urgency score preview (calculate client-side before submission)
- [ ] Test on a mobile browser (Chrome DevTools device mode)

### 3.4 NGO Coordinator Dashboard (View 2)
> This is your hero view. Make it impressive.

#### 3.4.1 Layout & Shell
- [ ] Build `DashboardPage.jsx` with a two-panel layout: left sidebar (stats + filters) + right main area (map + list)
- [ ] Add top nav: SevaSetu logo, coordinator name, logout
- [ ] Add summary cards row: Total Open Needs | Active Volunteers | Tasks In Progress | Completed Today

#### 3.4.2 Needs Heatmap
- [ ] Integrate `react-leaflet` with OpenStreetMap tiles (no API key needed)
- [ ] Plot each need as a circle marker — color-coded by urgency: 🔴 8–10, 🟠 5–7, 🟢 1–4
- [ ] Make markers clickable — popup shows: need title, urgency score, people affected, status, "Dispatch" button
- [ ] Add a legend component showing urgency color scale
- [ ] Center the map on the district with the most open needs

#### 3.4.3 Needs List Panel
- [ ] Build `NeedsList.jsx` — sortable table/card list below or beside the map
- [ ] Columns: Ward, Need Type, Urgency Score (badge), People Affected, Status (pill), Time Since Reported, Actions
- [ ] Add filter controls: by Status, by Need Type, by District
- [ ] Clicking a row highlights the corresponding map marker

#### 3.4.4 Volunteer Dispatch Flow
- [ ] When coordinator clicks "Dispatch" on a need, open a `MatchModal.jsx`
- [ ] `MatchModal` calls `GET /api/needs/:id/matches` and displays top 3 volunteers:
  - Volunteer name, skills (tag pills), distance from need, availability status, completion rate (%)
- [ ] "Assign" button on each volunteer card → calls `POST /api/tasks` → closes modal → updates need status to `assigned`
- [ ] Show a success toast notification on assignment

#### 3.4.5 Task Status Pipeline
- [ ] Build a `KanbanBoard.jsx` or pipeline view: Open → Assigned → In Progress → Completed
- [ ] Each task card shows: need title, assigned volunteer, time elapsed
- [ ] Allow drag-and-drop or button-based status updates (button approach is faster to build)

### 3.5 Volunteer App (View 3)
> Mobile-friendly web app — volunteers use this on their phones.

- [ ] Build `VolunteerPage.jsx` — mobile-first, card-based layout
- [ ] Show current availability toggle (ON/OFF switch) — calls `PATCH /api/volunteers/me/availability`
- [ ] Show assigned tasks list with status chips
- [ ] For each `assigned` task: show need details + a "Check In" button
  - [ ] "Check In" → capture current GPS → call `PATCH /api/tasks/:id/checkin`
- [ ] For each `in_progress` task: show a "Mark Complete" button
  - [ ] "Mark Complete" → call `PATCH /api/tasks/:id/complete` → show celebration state
- [ ] Show **Impact Stats** card: Tasks Completed, Completion Rate, Distance Covered (optional)
- [ ] Implement background location update: every 5 minutes, if task is active, push new GPS coords

---

## ⚙️ Phase 4 — Integration & End-to-End Testing

### 4.1 Connect Frontend to Backend
- [ ] Set `VITE_API_BASE_URL` in `.env` pointing to local backend
- [ ] Confirm all API calls use the axios `baseURL` — no hardcoded URLs
- [ ] Test the full lifecycle: Field worker submits need → Coordinator sees it on map → Matches volunteers → Assigns → Volunteer checks in → Volunteer completes → Status updates everywhere

### 4.2 Auth Flow Testing
- [ ] Register a coordinator, a volunteer, and a field worker
- [ ] Verify role-based routing works (coordinator sees dashboard, volunteer sees volunteer app)
- [ ] Verify JWT expiry handling — redirect to login on expired token

### 4.3 Algorithm Validation
- [ ] Create 5 test needs with varied parameters
- [ ] Verify urgency scores are ranked in the expected order
- [ ] Create 10 test volunteers at varying distances and skills
- [ ] Verify the matching engine returns the correct top 3 for each need type

### 4.4 Offline Form Testing
- [ ] Open the field form in Chrome → go to DevTools → Network → set to Offline
- [ ] Submit a need → verify it queues in IndexedDB (Application tab in DevTools)
- [ ] Restore network → verify the queued submission syncs to backend
- [ ] Confirm the need appears on the coordinator dashboard

---

## 🚀 Phase 5 — Deployment

### 5.1 Backend Deployment
- [ ] Create a `Procfile` or `railway.json` for Railway/Render
- [ ] Provision a PostgreSQL database on Railway (free tier)
- [ ] Run Prisma migrations on the production database: `npx prisma migrate deploy`
- [ ] Run seed script on production: `npm run seed`
- [ ] Set all environment variables in the Railway/Render dashboard
- [ ] Verify `GET /api/health` returns 200 on the live URL

### 5.2 Frontend Deployment
- [ ] Set `VITE_API_BASE_URL` to the production backend URL
- [ ] Run `npm run build` — verify no build errors
- [ ] Deploy to **Vercel** via GitHub integration (auto-deploy on push)
- [ ] Configure `vercel.json` for SPA routing (all routes → `index.html`)
- [ ] Verify the live frontend connects to the live backend

### 5.3 Smoke Test on Production
- [ ] Complete the full task lifecycle on the production URL
- [ ] Test on a real mobile device (Android + Chrome)
- [ ] Verify the map loads and markers appear
- [ ] Verify the volunteer matching returns results

---

## 🎯 Phase 6 — Demo Preparation

### 6.1 Data Seeding for Demo
- [ ] Seed a realistic scenario: flood event in a specific district
- [ ] Create 20+ needs clustered in 2–3 wards (shows heatmap clearly)
- [ ] Set 3–4 needs to different statuses so the pipeline view looks populated
- [ ] Create 2 active volunteers with tasks in-progress

### 6.2 Demo Script (5-Minute Flow)
- [ ] Minute 1: Show the **problem** — a WhatsApp group screenshot vs. SevaSetu
- [ ] Minute 2: Field worker submits a need on the form (do it live)
- [ ] Minute 3: Switch to coordinator dashboard — show it appearing on the heatmap with urgency score, click "Dispatch", show the matched volunteer list
- [ ] Minute 4: Assign the volunteer, switch to the volunteer app, check in + complete the task
- [ ] Minute 5: Return to dashboard — show the task completed, urgency resolved

### 6.3 Pitch Deck (Conceptual Slides)
- [ ] Slide 1: Problem — "India's 3.3M NGOs coordinate on WhatsApp and paper"
- [ ] Slide 2: Solution — SevaSetu one-liner + architecture diagram
- [ ] Slide 3: Live Demo screenshots (or link)
- [ ] Slide 4: Urgency Scoring + Volunteer Matching — show the algorithm visually
- [ ] Slide 5: Roadmap features (WhatsApp ingestion, OCR, multi-language, disaster mode)
- [ ] Slide 6: Scalability — same platform, 10 volunteers to 10,000
- [ ] Slide 7: Team

### 6.4 Concept Mockups (For Pitched Features)
- [ ] Wireframe: WhatsApp chatbot flow — field worker sends voice note → structured need record
- [ ] Wireframe: OCR upload — photo of paper form → extracted fields preview
- [ ] Wireframe: Disaster Mode toggle — escalated UI, bulk SMS notification concept
- [ ] Wireframe: Multi-language toggle (Hindi / Bengali / Tamil)

---

## 📊 Feature Status Tracker

| Feature | Build or Pitch | Priority | Status |
|---|---|---|---|
| Need submission form (offline PWA) | Build | P0 | ⬜ |
| Coordinator dashboard + heatmap | Build | P0 | ⬜ |
| Urgency scoring algorithm | Build | P0 | ⬜ |
| Volunteer matching engine (top 3) | Build | P0 | ⬜ |
| Task pipeline (Open→Assigned→Done) | Build | P0 | ⬜ |
| Auth (JWT, role-based) | Build | P0 | ⬜ |
| Volunteer app (mobile web) | Build | P1 | ⬜ |
| GPS check-in | Build | P1 | ⬜ |
| Offline sync (IndexedDB + SW) | Build | P1 | ⬜ |
| WhatsApp ingestion pipeline | Pitch | P2 | ⬜ |
| OCR paper form digitization | Pitch | P2 | ⬜ |
| Multi-language support | Pitch | P3 | ⬜ |
| Disaster mode toggle | Pitch | P3 | ⬜ |

---

## 🧱 Tech Stack Reference

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React + Vite | Fast setup, team familiarity |
| Styling | Tailwind CSS | Rapid UI without custom CSS |
| Maps | Leaflet.js + react-leaflet | No API key required |
| Backend | Node.js (Express) | Team's fastest language |
| ORM / Migrations | Prisma | Type-safe queries, declarative schema, auto-generated client |
| Database | PostgreSQL + PostGIS | Geospatial queries for matching |
| Auth | JWT (manual) | Simple + no vendor lock |
| Offline | Service Workers + IndexedDB | PWA standard, no extra library |
| Frontend deploy | Vercel | Free, instant GitHub deploy |
| Backend deploy | Railway or Render | Free tier, Postgres included |

---

## ⚡ Daily Sprint Breakdown

| Day | Focus |
|---|---|
| Day 1 | Phase 0 + Phase 1 (setup, DB schema, seed data) |
| Day 2 | Phase 2 (all backend APIs + algorithms) |
| Day 3 | Phase 3.1–3.3 (frontend scaffold + field form) |
| Day 4 | Phase 3.4 (coordinator dashboard — this is the big one) |
| Day 5 | Phase 3.5 + Phase 4 (volunteer app + integration testing) |
| Day 6 | Phase 5 (deployment + smoke testing) |
| Day 7 | Phase 6 (demo prep, pitch deck, polish) |

---

*Last updated: Sprint kickoff | Version 1.1 — Migrated from Knex to Prisma ORM*
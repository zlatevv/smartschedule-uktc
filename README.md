<div align="center">

# 📅 SmartSchedule

**An intelligent school timetable generation system built for УКТЦ**

[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MariaDB](https://img.shields.io/badge/MariaDB-11-003545?style=flat-square&logo=mariadb&logoColor=white)](https://mariadb.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

*Automated constraint-based scheduling · Drag-and-drop editing · One-command deployment*

---

</div>

## ✨ What is SmartSchedule?

SmartSchedule is a full-stack web application that **automatically generates weekly class timetables** for a Bulgarian technical high school. It replaces a manual, error-prone process with a constraint-solving engine that respects teacher availability, room capacity, curriculum hours, and group splits — then lets staff fine-tune the result through a polished drag-and-drop interface.

<div align="center">

| Feature | Description |
|---|---|
| ⚡ **Auto-generation** | Constraint-based solver fills an entire school's timetable in seconds |
| 🖱️ **Drag & drop editing** | Teachers can manually adjust slots after generation |
| 📋 **Curriculum-aware** | Subject sidebar filters to only show what each class is supposed to study |
| 📄 **PDF export** | Print-ready A4 landscape schedules for every class, with head teacher name |
| 🔐 **JWT auth** | Teacher login with 8-hour tokens; public read-only view for students |
| 🐳 **One-command deploy** | Entire stack runs with `docker compose up --build` |

</div>

---

## 🏗️ Architecture

```
┌─────────────────┐     nginx proxy      ┌─────────────────┐
│                 │   /api/* → :8000     │                 │
│  React + Vite   │ ──────────────────── │  FastAPI        │
│  (nginx :80)    │                      │  (uvicorn :8000)│
│                 │                      │                 │
└─────────────────┘                      └────────┬────────┘
                                                  │ SQLAlchemy
                                         ┌────────▼────────┐
                                         │   MariaDB 11    │
                                         │  (Docker volume)│
                                         └─────────────────┘
```

**Frontend** — React 18, Vite, custom CSS-in-JS design system (no UI library)  
**Backend** — FastAPI, SQLAlchemy ORM, PyMySQL, python-jose JWT  
**Database** — MariaDB 11, persisted via Docker named volume  
**Solver** — Custom constraint-based engine (`engine.py`)  
**Infrastructure** — Docker Compose, multi-stage builds, nginx reverse proxy

---

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — that's it

### Run locally

```bash
# 1. Clone the repo
git clone https://github.com/your-username/uktc-smartschedule.git
cd uktc-smartschedule

# 2. Build and start everything
docker compose up --build
```

On first run Docker will:
1. Pull MariaDB 11 and set up the database
2. Seed all teachers, subjects, rooms, classes and curriculum from CSV files
3. Build the React app and serve it via nginx
4. Start the FastAPI backend

Open **http://localhost** in your browser. Done.

> **Subsequent runs** — `docker compose up` (no rebuild needed, database is already seeded)

### Credentials

The default teacher login is configured in `backend/auth.py`. Students and parents can view schedules without logging in.

---

## 🐳 Docker Hub

Pre-built images are available on Docker Hub:

- [`zlatevv/smartschedule-backend`](https://hub.docker.com/r/zlatevv/smartschedule-backend)
- [`zlatevv/smartschedule-frontend`](https://hub.docker.com/r/zlatevv/smartschedule-frontend)

---

## 📁 Project Structure

```
uktc-smartschedule/
├── docker-compose.yml
│
├── backend/
│   ├── main.py              # FastAPI routes
│   ├── models.py            # SQLAlchemy models
│   ├── engine.py            # Constraint solver
│   ├── auth.py              # JWT authentication
│   ├── database.py          # DB connection (env-var driven)
│   ├── seed.py              # One-time DB seeding
│   ├── entrypoint.sh        # Docker startup script
│   ├── requirements.txt
│   ├── Dockerfile
│   └── *.csv                # Source data (teachers, rooms, classes…)
│
└── frontend/
    ├── src/
    │   ├── App.jsx           # Root shell + auth routing
    │   ├── constants.js      # Design tokens & global CSS
    │   ├── utils.js          # API client + auth helpers
    │   ├── utils/colors.js   # Subject colour palette
    │   ├── components/       # Reusable UI components
    │   │   ├── ScheduleGrid.jsx
    │   │   ├── SlotPill.jsx
    │   │   ├── LoginForm.jsx
    │   │   ├── DataList.jsx
    │   │   ├── Spinner.jsx
    │   │   └── Empty.jsx
    │   └── panels/           # Page-level views
    │       ├── ScheduleViewer.jsx
    │       ├── DataPanel.jsx
    │       └── GeneratorPanel.jsx
    ├── nginx.conf
    ├── vite.config.js
    └── Dockerfile
```

---

## 🗄️ Data Model

```
Teacher ──┐
          ├── TeacherSubject (many-to-many)
Subject ──┘
   │
   └── ClassCurriculum ── Class ── TimetableRecord
                                        │
                              Room ─────┘
```

- **Class** — school class (e.g. `211`, `256`) with an optional head teacher
- **ClassCurriculum** — which subjects a class takes and for how many hours/week
- **TimetableRecord** — a single scheduled slot (class × subject × teacher × room × day × period)
- **TeacherSubject** — which teachers are qualified to teach which subjects

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | — | Get JWT token |
| `GET` | `/api/classes` | — | List all classes |
| `GET` | `/api/classes/details` | — | Classes with head teacher names |
| `GET` | `/api/classes/{name}/subjects` | — | Curriculum subjects for a class |
| `GET` | `/api/schedule/class/{name}` | — | Full weekly schedule for a class |
| `POST` | `/api/schedule/slot` | ✅ | Manually add a slot |
| `POST` | `/api/schedule/generate/all` | ✅ | Trigger full auto-generation |
| `GET` | `/api/generate/status` | — | Poll solver progress |
| `POST` | `/api/schedule/clear` | ✅ | Wipe the entire schedule |
| `GET` | `/api/teachers` | — | List teachers |
| `GET` | `/api/subjects` | — | List subjects |
| `GET` | `/api/rooms` | — | List rooms |

Interactive docs available at **http://localhost:8000/docs** (Swagger UI).

---

## 🛠️ Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python seed.py               # seed the DB once
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                  # proxies /api to localhost:8000
```

---

## 🔧 Useful Commands

```bash
# Start everything
docker compose up

# Rebuild after code changes
docker compose up --build

# Stop everything
docker compose down

# Wipe database and re-seed from scratch
docker compose down -v
docker compose up --build

# View logs for a specific service
docker compose logs backend
docker compose logs frontend
```

---

## 📋 CSV Data Format

The backend seeds from these files in `backend/`:

**`teachers.csv`** — `Name,Subjects` (subjects pipe-separated)  
**`subjects.csv`** — `Name`  
**`rooms.csv`** — `Name,HasComputers`  
**`classes.csv`** — `Name,Grade,HeadTeacher`  
**`curriculum.csv`** — `Grade,name,Hours`

---

<div align="center">

Built with ☕ for УКТЦ &nbsp;·&nbsp; [Report a bug](../../issues) &nbsp;·&nbsp; [Request a feature](../../issues)

</div>

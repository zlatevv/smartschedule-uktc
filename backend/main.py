"""
SmartSchedule – FastAPI backend (main.py)
New in v2.1: JWT-based teacher authentication via auth.py
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import engine as solver_engine
from pydantic import BaseModel
from auth import (
    LoginRequest, TokenResponse,
    authenticate_teacher, _create_token,
    require_teacher,
)

models.Base.metadata.create_all(bind=engine)


# ── solver state (in-memory, single worker process) ───────────────────────────

class SolverState:
    def __init__(self):
        self.running      = False
        self.status       = "idle"   # idle | running | done | error
        self.message      = ""
class SlotRequest(BaseModel):
    classId: str     # Frontend sends the class name (e.g., "8А") here
    subjectId: int
    day: str         # "Monday", "Tuesday", etc.
    period: int      # 0-7

REVERSE_DAYS_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4
}

solver_state = SolverState()


def _run_solver_task():
    solver_state.running = True
    solver_state.status  = "running"
    solver_state.message = "Solver работи…"
    try:
        solver_engine.run_solver()
        solver_state.status  = "done"
        solver_state.message = "Разписанието е генерирано успешно."
    except Exception as e:
        solver_state.status  = "error"
        solver_state.message = str(e)
    finally:
        solver_state.running = False


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="SmartSchedule API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tighten to your frontend origin in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """
    Authenticate a teacher and return a JWT.
    POST /api/login  { "username": "admin", "password": "admin1234" }
    """
    username = authenticate_teacher(body.username, body.password)
    if not username:
        raise HTTPException(
            status_code=401,
            detail="Невалидно потребителско име или парола.",
        )
    token = _create_token(username)
    return TokenResponse(access_token=token, username=username)


# ── classes ───────────────────────────────────────────────────────────────────

@app.get("/api/classes")
def get_classes(db: Session = Depends(get_db)):
    classes = db.query(models.Class.name).order_by(models.Class.name).all()
    return [c.name for c in classes]


# ── subjects ──────────────────────────────────────────────────────────────────

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    return [
        {"id": s.id, "name": s.name}
        for s in db.query(models.Subject).order_by(models.Subject.name).all()
    ]


# ── rooms ─────────────────────────────────────────────────────────────────────

@app.get("/api/rooms")
def get_rooms(db: Session = Depends(get_db)):
    return [
        {"id": r.id, "name": r.name, "hasComputers": r.has_computers}
        for r in db.query(models.Room).order_by(models.Room.name).all()
    ]


# ── teachers ──────────────────────────────────────────────────────────────────

@app.get("/api/teachers")
def get_teachers(db: Session = Depends(get_db)):
    return [
        {"id": t.id, "name": t.name}
        for t in db.query(models.Teacher).order_by(models.Teacher.name).all()
    ]


# ── schedule for a class (public) ─────────────────────────────────────────────

DAYS_MAP = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}

@app.get("/api/schedule/class/{class_name}")
def get_class_schedule(class_name: str, db: Session = Depends(get_db)):
    db_class = (
        db.query(models.Class)
          .filter(models.Class.name == class_name)
          .first()
    )
    if not db_class:
        raise HTTPException(status_code=404, detail="Класът не е намерен")

    records = (
        db.query(models.TimetableRecord)
          .filter(models.TimetableRecord.class_id == db_class.id)
          .all()
    )

    schedule = {day: [[] for _ in range(8)] for day in DAYS_MAP.values()}

    if not records:
        return schedule

    subject_ids = {r.subject_id for r in records}
    room_ids    = {r.room_id    for r in records if r.room_id}
    teacher_ids = {r.teacher_id for r in records}

    subjects_by_id = {
        s.id: s for s in
        db.query(models.Subject).filter(models.Subject.id.in_(subject_ids))
    }
    rooms_by_id = {
        r.id: r for r in
        db.query(models.Room).filter(models.Room.id.in_(room_ids))
    } if room_ids else {}
    teachers_by_id = {
        t.id: t for t in
        db.query(models.Teacher).filter(models.Teacher.id.in_(teacher_ids))
    }

    for r in records:
        day_name = DAYS_MAP.get(r.day_of_week)
        if day_name is None or not (0 <= r.period < 8):
            continue

        subject = subjects_by_id.get(r.subject_id)
        room    = rooms_by_id.get(r.room_id)
        teacher = teachers_by_id.get(r.teacher_id)

        schedule[day_name][r.period].append({
            "subject": {"name": subject.name} if subject else None,
            "room":    {"roomId": room.name}   if room    else None,
            "teacher": {"name": teacher.name}  if teacher else None,
            "groupId": r.group_id,
        })

    return schedule


# ── generate (teacher only) ───────────────────────────────────────────────────

@app.post("/api/schedule/generate/all")
def generate_schedule(
    background_tasks: BackgroundTasks,
    teacher: str = Depends(require_teacher),   # ← protected
):
    if solver_state.running:
        raise HTTPException(
            status_code=409,
            detail="Solver вече работи. Провери /api/generate/status.",
        )
    background_tasks.add_task(_run_solver_task)
    return {
        "success": True,
        "message": "Генерирането започна. Провери /api/generate/status.",
        "started_by": teacher,
    }


@app.get("/api/generate/status")
def generate_status():
    return {
        "running": solver_state.running,
        "status":  solver_state.status,
        "message": solver_state.message,
    }


@app.post("/api/schedule/clear")
def clear_schedule(
        db: Session = Depends(get_db),
        teacher: str = Depends(require_teacher)
):
    """Wipes the entire schedule from the database."""
    if solver_state.running:
        raise HTTPException(
            status_code=409,
            detail="Не може да се изчисти разписанието докато генераторът работи."
        )

    try:
        db.query(models.TimetableRecord).delete()
        db.commit()
        return {"success": True, "message": "Разписанието е изчистено успешно."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Грешка при изчистване: {str(e)}")


@app.post("/api/schedule/slot")
def add_manual_slot(
        slot: SlotRequest,
        db: Session = Depends(get_db),
        teacher: str = Depends(require_teacher)
):
    """Adds a single manually dropped subject into the schedule."""
    if solver_state.running:
        raise HTTPException(
            status_code=409,
            detail="Не може да се редактира докато генераторът работи."
        )

    # 1. Resolve Class
    db_class = db.query(models.Class).filter(models.Class.name == slot.classId).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Класът не е намерен.")

    # 2. Resolve Day
    day_int = REVERSE_DAYS_MAP.get(slot.day)
    if day_int is None:
        raise HTTPException(status_code=400, detail="Невалиден ден.")

    # 3. Find a qualified teacher who is FREE at this (day, period) slot
    qualified = (
        db.query(models.TeacherSubject)
        .filter(models.TeacherSubject.subject_id == slot.subjectId)
        .all()
    )
    if not qualified:
        raise HTTPException(status_code=404, detail="Няма квалифицирани учители за този предмет.")

    busy_teacher_ids = {
        r.teacher_id for r in db.query(models.TimetableRecord)
        .filter(
        models.TimetableRecord.day_of_week == day_int,
        models.TimetableRecord.period == slot.period,
        ).all()
    }

        # Pick first qualified teacher who isn't busy
    assigned_teacher_id = None
    for ts in qualified:
        if ts.teacher_id not in busy_teacher_ids:
            assigned_teacher_id = ts.teacher_id
            break

    if assigned_teacher_id is None:
        raise HTTPException(
                status_code=409,
                detail="Всички квалифицирани учители за този предмет са заети в този час."
            )

    # 4. Insert Record
    try:
        new_record = models.TimetableRecord(
            class_id=db_class.id,
            subject_id=slot.subjectId,
            teacher_id=assigned_teacher_id,
            room_id=None,  # Manual slots start without a room assigned
            day_of_week=day_int,
            period=slot.period,
            group_id=0  # Default to whole class
        )
        db.add(new_record)
        db.commit()
        return {"success": True, "message": "Часът е добавен."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Грешка при запазване: {str(e)}")

@app.get("/api/classes/details")
def get_classes_details(db: Session = Depends(get_db)):
    classes = db.query(models.Class).all()
    result = []
    for c in classes:
        head = db.query(models.Teacher).filter(
            models.Teacher.id == c.head_teacher_id
        ).first() if c.head_teacher_id else None
        result.append({
            "name": c.name,
            "headTeacher": head.name if head else None,
        })
    return result
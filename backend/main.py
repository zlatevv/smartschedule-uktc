"""
SmartSchedule – FastAPI backend (main.py)
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import engine as solver_engine

models.Base.metadata.create_all(bind=engine)


# ── solver state (in-memory, single worker process) ───────────────────────────

class SolverState:
    def __init__(self):
        self.running   = False
        self.status    = "idle"   # idle | running | done | error
        self.message   = ""
        self.lesson_count = 0

solver_state = SolverState()


def _run_solver_task():
    solver_state.running  = True
    solver_state.status   = "running"
    solver_state.message  = "Solver is running..."
    try:
        solver_engine.run_solver()
        solver_state.status  = "done"
        solver_state.message = "Timetable generated successfully."
    except Exception as e:
        solver_state.status  = "error"
        solver_state.message = str(e)
    finally:
        solver_state.running = False


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="SmartSchedule API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tighten to your frontend origin in production
    allow_credentials=False,    # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# ── schedule for a class ──────────────────────────────────────────────────────

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

    # FIXED: Initialize with empty arrays instead of None so we can stack classes
    schedule = {day: [ [] for _ in range(8) ] for day in DAYS_MAP.values()}

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

        # FIXED: Append to the list so we don't overwrite parallel classes!
        schedule[day_name][r.period].append({
            "subject": {"name": subject.name} if subject else None,
            "room":    {"roomId": room.name}         if room    else None,
            "teacher": {"name": teacher.name}        if teacher else None,
            "groupId": r.group_id
        })

    return schedule


# ── generate ──────────────────────────────────────────────────────────────────

@app.post("/api/schedule/generate/all")
def generate_schedule(background_tasks: BackgroundTasks):
    if solver_state.running:
        raise HTTPException(
            status_code=409,
            detail="Solver is already running. Poll /api/generate/status for progress."
        )
    background_tasks.add_task(_run_solver_task)
    return {
        "success": True,
        "message": "Generation started. Poll /api/generate/status to check progress."
    }


@app.get("/api/generate/status")
def generate_status():
    return {
        "running":     solver_state.running,
        "status":      solver_state.status,
        "message":     solver_state.message,
    }
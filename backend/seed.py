"""
Seed script for the SmartSchedule database.
Reads data from the CSV files in the same directory:
  - teachers.csv
  - subjects.csv
  - classes.csv
  - curriculum.csv
  - rooms.csv

Usage:
    python seed_school_db.py

Place this file next to database.py, models.py, and the CSV files.
"""

import csv
import os
from database import SessionLocal, engine, Base
from models import Teacher, Subject, TeacherSubject, Room, Class, ClassCurriculum

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def read_csv(filename):
    path = os.path.join(BASE_DIR, filename)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Tables dropped and recreated.")

    db = SessionLocal()
    try:
        # ── 1. Subjects ──────────────────────────────────────────────────────
        subject_map: dict[str, int] = {}
        for row in read_csv("subjects.csv"):
            name = row["Name"].strip()
            if not name:
                continue
            subj = Subject(name=name)
            db.add(subj)
            db.flush()
            subject_map[name] = subj.id
        print(f"  Inserted {len(subject_map)} subjects.")

        # ── 2. Teachers + TeacherSubject links ───────────────────────────────
        teacher_map: dict[str, int] = {}
        ts_count = 0
        for row in read_csv("teachers.csv"):
            name = row["Name"].strip()
            if not name:
                continue
            teacher = Teacher(name=name)
            db.add(teacher)
            db.flush()
            teacher_map[name] = teacher.id

            # Subjects column is pipe-separated, e.g. "БЕЛ|Испански език"
            raw_subjects = row.get("Subjects", "").strip()
            if raw_subjects:
                for subj_name in raw_subjects.split("|"):
                    subj_name = subj_name.strip()
                    sid = subject_map.get(subj_name)
                    if sid is None:
                        print(f"  WARNING – unknown subject '{subj_name}' for teacher '{name}', skipping.")
                        continue
                    db.add(TeacherSubject(teacher_id=teacher.id, subject_id=sid))
                    ts_count += 1

        print(f"  Inserted {len(teacher_map)} teachers and {ts_count} teacher–subject links.")

        # ── 3. Rooms ─────────────────────────────────────────────────────────
        rooms_count = 0
        for row in read_csv("rooms.csv"):
            name = row["Name"].strip()
            if not name:
                continue
            has_computers = row["HasComputers"].strip().lower() == "true"
            db.add(Room(name=name, has_computers=has_computers))
            rooms_count += 1
        print(f"  Inserted {rooms_count} rooms.")

        # ── 4. Build grade → [(subject_name, hours)] from curriculum.csv ─────
        # curriculum.csv columns: Grade, SubjectName, Hours
        grade_subjects: dict[int, list[tuple[str, int]]] = {}
        for row in read_csv("curriculum.csv"):
            grade = int(row["Grade"].strip())
            subj_name = row["SubjectName"].strip()
            hours = int(row["Hours"].strip())
            grade_subjects.setdefault(grade, []).append((subj_name, hours))

        # ── 5. Classes + ClassCurriculum ─────────────────────────────────────
        # classes.csv columns: Name, Grade, HeadTeacher
        curriculum_count = 0
        missing_teachers = set()
        for row in read_csv("classes.csv"):
            class_name = row["Name"].strip()
            grade = int(row["Grade"].strip())
            head_teacher_name = row["HeadTeacher"].strip()

            tid = teacher_map.get(head_teacher_name)
            if tid is None and head_teacher_name not in missing_teachers:
                print(f"  WARNING – head teacher '{head_teacher_name}' not found for class {class_name}.")
                missing_teachers.add(head_teacher_name)

            cls = Class(name=class_name, head_teacher_id=tid)
            db.add(cls)
            db.flush()

            for subj_name, hours in grade_subjects.get(grade, []):
                sid = subject_map.get(subj_name)
                if sid is None:
                    print(f"  WARNING – unknown subject '{subj_name}' in curriculum for class {class_name}, skipping.")
                    continue
                db.add(ClassCurriculum(
                    class_id=cls.id,
                    subject_id=sid,
                    hours_per_week=hours,
                ))
                curriculum_count += 1

        print(f"  Inserted {len(read_csv('classes.csv'))} classes and {curriculum_count} curriculum rows.")

        db.commit()
        print("\nDatabase seeded successfully.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed()

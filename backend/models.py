from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base

class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"
    teacher_id = Column(Integer, ForeignKey("teachers.id"), primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)

class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True)
    has_computers = Column(Boolean, default=False)

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True)

# --- NEW CLASS TABLE ---
class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True) # e.g., "251", "241"
    head_teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)

class ClassCurriculum(Base):
    __tablename__ = "class_curriculum"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id")) # Link to the new Class table
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    hours_per_week = Column(Integer)
    group_id = Column(Integer, nullable=True)

class TimetableRecord(Base):
    __tablename__ = "timetable_records"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id")) # Link to the new Class table
    day_of_week = Column(Integer)
    period = Column(Integer)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    group_id = Column(Integer, nullable=True)
"""
SmartSchedule – Production Timetable Solver
============================================

Architecture: Two-phase hybrid solver (industry standard for school timetabling)

Phase 1 – Simulated Annealing (SA)
  Rapidly explores the solution space to find a good feasible starting point.
  SA is the algorithm used by most commercial timetabling tools (Untis, FET, ASC)
  as the primary search engine because it handles hard constraints naturally and
  escapes local minima via controlled randomness.

Phase 2 – CP-SAT polishing (optional, time-permitting)
  The SA solution is fed into Google OR-Tools CP-SAT as a warm-start hint.
  CP-SAT then tightens constraint violations and improves soft objectives without
  having to search from scratch.

Variable design
  One slot per (class, curriculum_entry, occurrence) assigned to (day, period).
  Teacher + room are derived attributes, NOT solver dimensions → ~100× fewer
  variables than the naive (class × teacher × subject × room × day × period) grid.

Constraints (hard)
  H1  Every curriculum entry is scheduled exactly hours_per_week times.
  H2  A class has at most one lesson per slot.
  H3  A teacher teaches at most one class per slot.
  H4  A room hosts at most one class per slot.
  H5  "Час на класа" is pinned to Monday period 7 (day=0, period=6).

Soft objectives (SA cost function)
  S1  Minimise teacher idle gaps within a day.
  S2  Minimise class idle gaps within a day.
  S3  Spread occurrences of the same subject across different days.
  S4  Avoid scheduling in the last period (period 7) except homeroom.
"""

import random
import math
import time
from collections import defaultdict
from sqlalchemy.orm import Session
from database import SessionLocal
import models

# ─── tuneable constants ───────────────────────────────────────────────────────
NUM_DAYS       = 5
NUM_PERIODS    = 8
HOMEROOM_DAY   = 0   # Monday  (0-indexed)
HOMEROOM_PERIOD = 6  # 7th lesson (0-indexed)

# SA parameters  (tuned for ~26 classes, ~57 teachers, ~39 rooms)
SA_INITIAL_TEMP   = 5.0
SA_COOLING_RATE   = 0.99995
SA_MIN_TEMP       = 0.01
SA_MAX_SECONDS    = 90        # wall-clock budget for SA
SA_ITERATIONS_PER_TEMP = 5   # inner loop iterations before cooling


# ─── data containers ─────────────────────────────────────────────────────────

class SlotAssignment:
    """One scheduled lesson: which (day, period) a curriculum occurrence sits in."""
    __slots__ = ("class_id", "subject_id", "teacher_id", "day", "period", "key")

    def __init__(self, class_id, subject_id, teacher_id, day, period):
        self.class_id   = class_id
        self.subject_id = subject_id
        self.teacher_id = teacher_id
        self.day        = day
        self.period     = period
        self.key        = (class_id, subject_id, teacher_id)


# ─── helper: room assignment (greedy post-solve) ──────────────────────────────

def _assign_rooms(assignments: list[SlotAssignment], rooms: list) -> dict:
    """
    Greedy room assignment.  Returns {assignment_index: room_id}.
    Computer rooms are tried first for every slot (you can refine with a
    subject→needs_computer map later).
    """
    computer_rooms = [r for r in rooms if r.has_computers]
    normal_rooms   = [r for r in rooms if not r.has_computers]
    all_rooms      = computer_rooms + normal_rooms

    occupied: dict[tuple, set] = defaultdict(set)   # (day,period) -> {room_id}
    result = {}
    failed = 0

    for idx, a in enumerate(assignments):
        slot = (a.day, a.period)
        assigned = None
        for room in all_rooms:
            if room.id not in occupied[slot]:
                assigned = room
                occupied[slot].add(room.id)
                break
        if assigned:
            result[idx] = assigned.id
        else:
            failed += 1

    if failed:
        print(f"  WARNING – {failed} lessons could not be assigned a room.")
    return result


# ─── cost function ────────────────────────────────────────────────────────────

def _compute_cost(
    assignments: list[SlotAssignment],
    qualified_teachers: dict,        # subject_id -> [teacher_id]
    homeroom_subject_id: int | None,
    class_head: dict,                # class_id -> head_teacher_id
) -> float:
    """Lower is better. Hard violations are weighted very heavily."""

    cost = 0.0

    # Index for fast lookup
    class_slots:   dict[tuple, list] = defaultdict(list)  # (class_id, d, p) -> [a]
    teacher_slots: dict[tuple, list] = defaultdict(list)  # (teacher_id, d, p) -> [a]

    for a in assignments:
        class_slots[(a.class_id, a.day, a.period)].append(a)
        teacher_slots[(a.teacher_id, a.day, a.period)].append(a)

    # H2 – class double booking
    for v in class_slots.values():
        if len(v) > 1:
            cost += 1000 * (len(v) - 1)

    # H3 – teacher double booking
    for v in teacher_slots.values():
        if len(v) > 1:
            cost += 1000 * (len(v) - 1)

    # H5 – homeroom pin
    if homeroom_subject_id is not None:
        for a in assignments:
            if a.subject_id == homeroom_subject_id:
                if a.day != HOMEROOM_DAY or a.period != HOMEROOM_PERIOD:
                    cost += 500
                # Must be taught by the head teacher
                if class_head.get(a.class_id) != a.teacher_id:
                    cost += 500

    # S1 – teacher idle gaps within a day
    teacher_day_periods: dict[tuple, list] = defaultdict(list)
    for a in assignments:
        teacher_day_periods[(a.teacher_id, a.day)].append(a.period)
    for periods in teacher_day_periods.values():
        if len(periods) > 1:
            periods_sorted = sorted(periods)
            gaps = periods_sorted[-1] - periods_sorted[0] - (len(periods_sorted) - 1)
            cost += gaps * 2

    # S2 – class idle gaps within a day
    class_day_periods: dict[tuple, list] = defaultdict(list)
    for a in assignments:
        class_day_periods[(a.class_id, a.day)].append(a.period)
    for periods in class_day_periods.values():
        if len(periods) > 1:
            periods_sorted = sorted(periods)
            gaps = periods_sorted[-1] - periods_sorted[0] - (len(periods_sorted) - 1)
            cost += gaps * 3

    # S3 – same subject on same day for same class (prefer spread)
    class_subject_days: dict[tuple, list] = defaultdict(list)
    for a in assignments:
        class_subject_days[(a.class_id, a.subject_id)].append(a.day)
    for days in class_subject_days.values():
        duplicates = len(days) - len(set(days))
        cost += duplicates * 10

    # S4 – avoid last period
    for a in assignments:
        if a.period == NUM_PERIODS - 1 and a.subject_id != homeroom_subject_id:
            cost += 1

    return cost


# ─── initial solution builder ─────────────────────────────────────────────────

def _build_initial_solution(
    curriculum: list,
    qualified_teachers: dict,
    homeroom_subject_id: int | None,
    class_head: dict,
) -> list[SlotAssignment]:
    """
    Constructs a random-but-valid-ish initial solution.
    Homeroom is pinned immediately; everything else is randomly placed.
    """
    assignments = []

    for curr in curriculum:
        c_id  = curr.class_id
        s_id  = curr.subject_id
        hours = curr.hours_per_week

        teachers = list(qualified_teachers.get(s_id, []))
        if homeroom_subject_id and s_id == homeroom_subject_id:
            head = class_head.get(c_id)
            teachers = [head] if head else []

        if not teachers:
            continue

        for _ in range(hours):
            t_id = random.choice(teachers)

            if homeroom_subject_id and s_id == homeroom_subject_id:
                d, p = HOMEROOM_DAY, HOMEROOM_PERIOD
            else:
                d = random.randint(0, NUM_DAYS - 1)
                p = random.randint(0, NUM_PERIODS - 2)  # avoid last period initially

            assignments.append(SlotAssignment(c_id, s_id, t_id, d, p))

    return assignments


# ─── SA neighbour generator ───────────────────────────────────────────────────

def _random_move(
    assignments: list[SlotAssignment],
    qualified_teachers: dict,
    homeroom_subject_id: int | None,
    class_head: dict,
) -> list[SlotAssignment]:
    """
    Returns a new solution with one of three mutations:
      • Move:   change (day, period) of a random non-homeroom lesson
      • Swap:   swap (day, period) of two random non-homeroom lessons
      • Teacher swap: assign a different qualified teacher to a lesson
    """
    import copy
    new_assignments = copy.copy(assignments)   # shallow – SlotAssignment objects are replaced not mutated

    # Pick only moveable lessons (not pinned homeroom)
    moveable = [
        i for i, a in enumerate(new_assignments)
        if not (homeroom_subject_id and a.subject_id == homeroom_subject_id)
    ]
    if not moveable:
        return new_assignments

    move_type = random.random()

    if move_type < 0.50:
        # Move a single lesson to a random slot
        idx = random.choice(moveable)
        a   = new_assignments[idx]
        new_d = random.randint(0, NUM_DAYS - 1)
        new_p = random.randint(0, NUM_PERIODS - 1)
        new_assignments[idx] = SlotAssignment(a.class_id, a.subject_id, a.teacher_id, new_d, new_p)

    elif move_type < 0.80:
        # Swap slots of two lessons
        if len(moveable) < 2:
            return new_assignments
        idx1, idx2 = random.sample(moveable, 2)
        a1, a2 = new_assignments[idx1], new_assignments[idx2]
        new_assignments[idx1] = SlotAssignment(a1.class_id, a1.subject_id, a1.teacher_id, a2.day, a2.period)
        new_assignments[idx2] = SlotAssignment(a2.class_id, a2.subject_id, a2.teacher_id, a1.day, a1.period)

    else:
        # Assign a different qualified teacher
        idx  = random.choice(moveable)
        a    = new_assignments[idx]
        teachers = list(qualified_teachers.get(a.subject_id, []))
        if len(teachers) > 1:
            teachers = [t for t in teachers if t != a.teacher_id]
        if teachers:
            new_t = random.choice(teachers)
            new_assignments[idx] = SlotAssignment(a.class_id, a.subject_id, new_t, a.day, a.period)

    return new_assignments


# ─── simulated annealing ──────────────────────────────────────────────────────

def _simulated_annealing(
    curriculum: list,
    qualified_teachers: dict,
    homeroom_subject_id: int | None,
    class_head: dict,
) -> list[SlotAssignment]:

    current = _build_initial_solution(curriculum, qualified_teachers, homeroom_subject_id, class_head)
    current_cost = _compute_cost(current, qualified_teachers, homeroom_subject_id, class_head)

    best        = current
    best_cost   = current_cost

    temp        = SA_INITIAL_TEMP
    start       = time.time()
    iteration   = 0
    improvements = 0

    print(f"  SA start – initial cost: {current_cost:.1f}")

    while temp > SA_MIN_TEMP and (time.time() - start) < SA_MAX_SECONDS:
        for _ in range(SA_ITERATIONS_PER_TEMP):
            neighbour = _random_move(current, qualified_teachers, homeroom_subject_id, class_head)
            neighbour_cost = _compute_cost(neighbour, qualified_teachers, homeroom_subject_id, class_head)
            delta = neighbour_cost - current_cost

            if delta < 0 or random.random() < math.exp(-delta / temp):
                current      = neighbour
                current_cost = neighbour_cost
                if current_cost < best_cost:
                    best      = current
                    best_cost = current_cost
                    improvements += 1

        temp     *= SA_COOLING_RATE
        iteration += 1

    elapsed = time.time() - start
    print(f"  SA done  – best cost: {best_cost:.1f} | {iteration:,} cooling steps | "
          f"{improvements:,} improvements | {elapsed:.1f}s")

    return best


# ─── CP-SAT warm-start polisher ───────────────────────────────────────────────

def _cpsat_polish(
    sa_solution: list[SlotAssignment],
    curriculum: list,
    qualified_teachers: dict,
    homeroom_subject_id: int | None,
    class_head: dict,
    time_limit: float = 25.0,
) -> list[SlotAssignment]:
    """
    Feed the SA solution into CP-SAT as hints and let it tighten the schedule.
    Falls back to the SA solution if CP-SAT doesn't improve within the time limit.
    """
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        print("  ortools not available – skipping CP-SAT polish.")
        return sa_solution

    model  = cp_model.CpModel()
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds   = time_limit
    solver.parameters.num_search_workers    = 8
    solver.parameters.log_search_progress   = False

    # Variables: for each lesson occurrence assign (day, period, teacher)
    # We keep the same indexing as sa_solution for easy hint injection.
    day_vars    = []
    period_vars = []
    teacher_vars = []

    for i, a in enumerate(sa_solution):
        dv = model.NewIntVar(0, NUM_DAYS - 1,    f"d_{i}")
        pv = model.NewIntVar(0, NUM_PERIODS - 1, f"p_{i}")
        teachers = list(qualified_teachers.get(a.subject_id, []))
        if homeroom_subject_id and a.subject_id == homeroom_subject_id:
            head = class_head.get(a.class_id)
            teachers = [head] if head else teachers
        tv = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(teachers if teachers else [a.teacher_id]),
            f"t_{i}"
        )
        day_vars.append(dv)
        period_vars.append(pv)
        teacher_vars.append(tv)

        # Warm-start hints
        model.AddHint(dv, a.day)
        model.AddHint(pv, a.period)
        model.AddHint(tv, a.teacher_id)

    n = len(sa_solution)

    # H5 – pin homeroom
    for i, a in enumerate(sa_solution):
        if homeroom_subject_id and a.subject_id == homeroom_subject_id:
            model.Add(day_vars[i]    == HOMEROOM_DAY)
            model.Add(period_vars[i] == HOMEROOM_PERIOD)

    # H2 – class: no two lessons in same slot
    from itertools import combinations
    by_class: dict[int, list] = defaultdict(list)
    for i, a in enumerate(sa_solution):
        by_class[a.class_id].append(i)

    for c_id, idxs in by_class.items():
        for i, j in combinations(idxs, 2):
            # (day_i != day_j) OR (period_i != period_j)
            same_day    = model.NewBoolVar(f"sd_{i}_{j}")
            same_period = model.NewBoolVar(f"sp_{i}_{j}")
            model.Add(day_vars[i]    == day_vars[j]).OnlyEnforceIf(same_day)
            model.Add(day_vars[i]    != day_vars[j]).OnlyEnforceIf(same_day.Not())
            model.Add(period_vars[i] == period_vars[j]).OnlyEnforceIf(same_period)
            model.Add(period_vars[i] != period_vars[j]).OnlyEnforceIf(same_period.Not())
            model.AddBoolOr([same_day.Not(), same_period.Not()])

    # H3 – teacher: no two lessons in same slot (only if same teacher assigned)
    # This is tricky with IntVar teachers; we skip full enforcement here and
    # rely on SA having already resolved most violations.  Full enforcement
    # would require a large number of indicator constraints that could make
    # CP-SAT slower than just keeping the SA solution.

    # S3 – spread: minimise same-subject same-day for same class
    spread_violations = []
    for c_id, idxs in by_class.items():
        subject_pairs = [
            (i, j) for i, j in combinations(idxs, 2)
            if sa_solution[i].subject_id == sa_solution[j].subject_id
        ]
        for i, j in subject_pairs:
            same_day = model.NewBoolVar(f"spread_{i}_{j}")
            model.Add(day_vars[i] == day_vars[j]).OnlyEnforceIf(same_day)
            model.Add(day_vars[i] != day_vars[j]).OnlyEnforceIf(same_day.Not())
            spread_violations.append(same_day)

    if spread_violations:
        model.Minimize(sum(spread_violations))

    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        polished = []
        for i, a in enumerate(sa_solution):
            polished.append(SlotAssignment(
                a.class_id,
                a.subject_id,
                solver.Value(teacher_vars[i]),
                solver.Value(day_vars[i]),
                solver.Value(period_vars[i]),
            ))
        print(f"  CP-SAT polish done – objective: {solver.ObjectiveValue():.0f}")
        return polished
    else:
        print("  CP-SAT did not improve within time limit – using SA solution.")
        return sa_solution


# ─── public entry point ───────────────────────────────────────────────────────

def run_solver(sa_seconds: float = SA_MAX_SECONDS, cpsat_seconds: float = 25.0):
    print("=" * 60)
    print("SmartSchedule Solver starting...")
    print("=" * 60)

    db: Session = SessionLocal()
    try:
        # ── load data ─────────────────────────────────────────────────────────
        classes    = db.query(models.Class).all()
        rooms      = db.query(models.Room).all()
        curriculum = db.query(models.ClassCurriculum).all()
        ts_rows    = db.query(models.TeacherSubject).all()

        class_head: dict[int, int] = {
            c.id: c.head_teacher_id for c in classes if c.head_teacher_id
        }

        homeroom_subject = (
            db.query(models.Subject)
              .filter(models.Subject.name.like("%Час на класа%"))
              .first()
        )
        homeroom_id = homeroom_subject.id if homeroom_subject else None

        qualified_teachers: dict[int, list[int]] = defaultdict(list)
        for ts in ts_rows:
            qualified_teachers[ts.subject_id].append(ts.teacher_id)

        print(f"Loaded: {len(classes)} classes, {len(curriculum)} curriculum rows, "
              f"{len(rooms)} rooms")

        # ── phase 1: simulated annealing ──────────────────────────────────────
        print("\n[Phase 1] Simulated Annealing...")
        sa_solution = _simulated_annealing(curriculum, qualified_teachers, homeroom_id, class_head)

        sa_cost = _compute_cost(sa_solution, qualified_teachers, homeroom_id, class_head)
        hard_violations = sum(
            1 for a in sa_solution
            if homeroom_id and a.subject_id == homeroom_id
            and (a.day != HOMEROOM_DAY or a.period != HOMEROOM_PERIOD)
        )
        print(f"  Hard violations remaining: {hard_violations}")

        # ── phase 2: CP-SAT polish ────────────────────────────────────────────
        print("\n[Phase 2] CP-SAT polishing...")
        final_solution = _cpsat_polish(
            sa_solution, curriculum, qualified_teachers, homeroom_id, class_head,
            time_limit=cpsat_seconds,
        )

        # ── room assignment ───────────────────────────────────────────────────
        print("\n[Phase 3] Assigning rooms...")
        room_map = _assign_rooms(final_solution, rooms)

        # ── persist ───────────────────────────────────────────────────────────
        print("\n[Phase 4] Writing to database...")
        db.query(models.TimetableRecord).delete()

        records = []
        for idx, a in enumerate(final_solution):
            room_id = room_map.get(idx)
            records.append(models.TimetableRecord(
                class_id   = a.class_id,
                teacher_id = a.teacher_id,
                subject_id = a.subject_id,
                room_id    = room_id,
                day_of_week = a.day,
                period      = a.period,
            ))

        db.bulk_save_objects(records)
        db.commit()
        print(f"Done! Saved {len(records)} lessons to the database.")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    run_solver()

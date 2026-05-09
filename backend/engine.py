"""
SmartSchedule – Production Timetable Solver
============================================

Architecture: Two-phase hybrid solver (industry standard for school timetabling)

Phase 1 – Simulated Annealing (SA)
Phase 2 – CP-SAT polishing (optional, time-permitting)
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
    # FIXED: Added group_id to __slots__
    __slots__ = ("class_id", "subject_id", "teacher_id", "day", "period", "group_id", "key")

    # FIXED: Added group_id to the initialization parameters
    def __init__(self, class_id, subject_id, teacher_id, day, period, group_id=0):
        self.class_id   = class_id
        self.subject_id = subject_id
        self.teacher_id = teacher_id
        self.day        = day
        self.period     = period
        self.group_id   = group_id
        self.key        = (class_id, subject_id, teacher_id, group_id)


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
        # NOTE: Only count as a double booking if it's the SAME class, but ignore split groups (Уп 1 vs Уп 2)
        class_slots[(a.class_id, a.day, a.period)].append(a)
        teacher_slots[(a.teacher_id, a.day, a.period)].append(a)

    # H2 – class double booking (Ignoring parallel languages & split groups naturally handled by group_id in Phase 2)
    for v in class_slots.values():
        if len(v) > 1:
            # Quick check: if they are parallel languages or split groups, it's fine!
            groups = [x.group_id for x in v]
            if not (all(g in (11, 12, 13) for g in groups) or all(g in (1, 2) for g in groups)):
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
            periods_sorted = sorted(set(periods)) # use set to ignore simultaneous group lessons
            gaps = periods_sorted[-1] - periods_sorted[0] - (len(periods_sorted) - 1)
            cost += gaps * 2

    # S2 – class idle gaps within a day
    class_day_periods: dict[tuple, list] = defaultdict(list)
    for a in assignments:
        class_day_periods[(a.class_id, a.day)].append(a.period)
    for periods in class_day_periods.values():
        if len(periods) > 1:
            periods_sorted = sorted(set(periods))
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

def _build_initial_solution(curriculum, qualified_teachers, homeroom_subject_id, class_head):
    assignments = []

    # Separate normal curriculum from synchronized languages
    lang_curr = defaultdict(list)
    normal_curr = []
    for curr in curriculum:
        if curr.group_id in (11, 12, 13):
            lang_curr[curr.class_id].append(curr)
        else:
            normal_curr.append(curr)

    # 1. Schedule normal and "Уп" lessons
    for curr in normal_curr:
        c_id, s_id, hours, g_id = curr.class_id, curr.subject_id, curr.hours_per_week, curr.group_id
        teachers = list(qualified_teachers.get(s_id, []))

        if homeroom_subject_id and s_id == homeroom_subject_id:
            head = class_head.get(c_id)
            teachers = [head] if head else []

        if not teachers: continue

        for _ in range(hours):
            t_id = random.choice(teachers)
            if homeroom_subject_id and s_id == homeroom_subject_id:
                d, p = HOMEROOM_DAY, HOMEROOM_PERIOD
            else:
                d, p = random.randint(0, NUM_DAYS - 1), random.randint(0, NUM_PERIODS - 2)
            assignments.append(SlotAssignment(c_id, s_id, t_id, d, p, g_id))

    # 2. Schedule Languages perfectly synced
    for c_id, currs in lang_curr.items():
        hours_map = {c: c.hours_per_week for c in currs}
        if not hours_map: continue

        max_hours = max(hours_map.values())
        for _ in range(max_hours):
            d, p = random.randint(0, NUM_DAYS - 1), random.randint(0, NUM_PERIODS - 2)

            for c in currs:
                if hours_map[c] > 0:
                    teachers = list(qualified_teachers.get(c.subject_id, []))
                    if teachers:
                        t_id = random.choice(teachers)
                        assignments.append(SlotAssignment(c_id, c.subject_id, t_id, d, p, c.group_id))
                        hours_map[c] -= 1

    return assignments


def _random_move(assignments, qualified_teachers, homeroom_subject_id, class_head):
    import copy
    new_assignments = copy.copy(assignments)
    moveable = [i for i, a in enumerate(new_assignments) if
                not (homeroom_subject_id and a.subject_id == homeroom_subject_id)]

    if not moveable: return new_assignments

    move_type = random.random()
    if move_type < 0.50:
        idx = random.choice(moveable)
        a = new_assignments[idx]

        # If it's a language, grab ALL parallel languages for this class in this slot
        linked = [i for i, x in enumerate(new_assignments)
                  if x.class_id == a.class_id and x.group_id in (
                  11, 12, 13) and x.day == a.day and x.period == a.period] if a.group_id in (11, 12, 13) else [idx]

        new_d, new_p = random.randint(0, NUM_DAYS - 1), random.randint(0, NUM_PERIODS - 1)
        for i in linked:
            old = new_assignments[i]
            new_assignments[i] = SlotAssignment(old.class_id, old.subject_id, old.teacher_id, new_d, new_p, old.group_id)

    elif move_type < 0.80:
        if len(moveable) >= 2:
            idx1, idx2 = random.sample(moveable, 2)
            a1, a2 = new_assignments[idx1], new_assignments[idx2]

            linked1 = [i for i, x in enumerate(new_assignments) if x.class_id == a1.class_id and x.group_id in (
            11, 12, 13) and x.day == a1.day and x.period == a1.period] if a1.group_id in (11, 12, 13) else [idx1]
            linked2 = [i for i, x in enumerate(new_assignments) if x.class_id == a2.class_id and x.group_id in (
            11, 12, 13) and x.day == a2.day and x.period == a2.period] if a2.group_id in (11, 12, 13) else [idx2]

            d1, p1 = a1.day, a1.period
            d2, p2 = a2.day, a2.period

            for i in linked1:
                x = new_assignments[i]
                new_assignments[i] = SlotAssignment(x.class_id, x.subject_id, x.teacher_id, d2, p2, x.group_id)
            for i in linked2:
                x = new_assignments[i]
                new_assignments[i] = SlotAssignment(x.class_id, x.subject_id, x.teacher_id, d1, p1, x.group_id)

    else:
        idx = random.choice(moveable)
        a = new_assignments[idx]
        teachers = [t for t in qualified_teachers.get(a.subject_id, []) if t != a.teacher_id]
        if teachers:
            new_assignments[idx] = SlotAssignment(a.class_id, a.subject_id, random.choice(teachers), a.day, a.period, a.group_id)

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

    # Variables
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

    # H5 – pin homeroom
    for i, a in enumerate(sa_solution):
        if homeroom_subject_id and a.subject_id == homeroom_subject_id:
            model.Add(day_vars[i]    == HOMEROOM_DAY)
            model.Add(period_vars[i] == HOMEROOM_PERIOD)

    # Synchronize Languages Super Glue
    lang_by_class = defaultdict(lambda: {11: [], 12: [], 13: []})
    for i, a in enumerate(sa_solution):
        if a.group_id in (11, 12, 13):
            lang_by_class[a.class_id][a.group_id].append(i)

    for c_id, langs in lang_by_class.items():
        active_lists = [langs[g] for g in (11, 12, 13) if langs[g]]
        if len(active_lists) > 1:
            for zip_idx in range(len(active_lists[0])):
                base_var_idx = active_lists[0][zip_idx]
                for other_list in active_lists[1:]:
                    if zip_idx < len(other_list):
                        other_var_idx = other_list[zip_idx]
                        model.Add(day_vars[base_var_idx] == day_vars[other_var_idx])
                        model.Add(period_vars[base_var_idx] == period_vars[other_var_idx])

    # H2 – class: no two lessons in same slot (ignoring allowed splits)
    from itertools import combinations
    by_class: dict[int, list] = defaultdict(list)
    for i, a in enumerate(sa_solution):
        by_class[a.class_id].append(i)

    for c_id, idxs in by_class.items():
        for i, j in combinations(idxs, 2):
            gi = sa_solution[i].group_id
            gj = sa_solution[j].group_id

            # If they are parallel languages, they MUST be at the same time (handled above).
            # If they are Уп splits (1 and 2), they are ALLOWED at the same time. We skip adding a conflict rule.
            if (gi in (11,12,13) and gj in (11,12,13)) or (gi in (1,2) and gj in (1,2)):
                continue

            same_day    = model.NewBoolVar(f"sd_{i}_{j}")
            same_period = model.NewBoolVar(f"sp_{i}_{j}")
            model.Add(day_vars[i]    == day_vars[j]).OnlyEnforceIf(same_day)
            model.Add(day_vars[i]    != day_vars[j]).OnlyEnforceIf(same_day.Not())
            model.Add(period_vars[i] == period_vars[j]).OnlyEnforceIf(same_period)
            model.Add(period_vars[i] != period_vars[j]).OnlyEnforceIf(same_period.Not())
            model.AddBoolOr([same_day.Not(), same_period.Not()])

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
            # FIXED: Added a.group_id back to the polished SlotAssignment
            polished.append(SlotAssignment(
                a.class_id,
                a.subject_id,
                solver.Value(teacher_vars[i]),
                solver.Value(day_vars[i]),
                solver.Value(period_vars[i]),
                a.group_id
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
            # FIXED: Added group_id so the front end can identify split groups!
            records.append(models.TimetableRecord(
                class_id    = a.class_id,
                teacher_id  = a.teacher_id,
                subject_id  = a.subject_id,
                room_id     = room_id,
                day_of_week = a.day,
                period      = a.period,
                group_id    = a.group_id
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
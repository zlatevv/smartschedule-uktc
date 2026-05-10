"""
SmartSchedule – Production Timetable Solver (Compression Mode)
==============================================================
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
NUM_PERIODS    = 10
HOMEROOM_DAY   = 0
HOMEROOM_PERIOD = 6  # 7th hour (index 6)

SA_INITIAL_TEMP   = 10.0
SA_COOLING_RATE   = 0.99995
SA_MIN_TEMP       = 0.01
SA_MAX_SECONDS    = 90
SA_ITERATIONS_PER_TEMP = 15

SYNC_SETS = [(11, 12, 13), (1, 2)]

# ─── data containers ─────────────────────────────────────────────────────────

class SlotAssignment:
    __slots__ = ("class_id", "subject_id", "teacher_id", "day", "period", "group_id", "key")

    def __init__(self, class_id, subject_id, teacher_id, day, period, group_id=0):
        self.class_id   = class_id
        self.subject_id = subject_id
        self.teacher_id = teacher_id
        self.day        = day
        self.period     = period
        self.group_id   = group_id
        self.key        = (class_id, subject_id, group_id)


# ─── helper: room assignment (course-based grouping) ──────────────────────────

def is_general_subject(subj_name: str, group_id: int) -> bool:
    if group_id in (1, 2):
        return False
    words = subj_name.lower().replace('-', ' ').replace('.', ' ').split()
    if "уп" in words or "ит" in words or "информатика" in words:
        return False
    return True


# ─── helper: room assignment (course-based grouping) ──────────────────────────

def _assign_rooms(assignments: list[SlotAssignment], rooms: list, subjects_dict: dict) -> dict:
    computer_rooms = [r for r in rooms if r.has_computers]
    normal_rooms = [r for r in rooms if not r.has_computers]

    courses = defaultdict(list)
    for idx, a in enumerate(assignments):
        courses[a.key].append((idx, a))

    occupied: dict[tuple, set] = defaultdict(set)
    result = {}
    failed = 0

    for key, slots in courses.items():
        class_id, subject_id, group_id = key
        subj = subjects_dict.get(subject_id)
        subj_name = subj.name if subj else ""

        is_gen = is_general_subject(subj_name, group_id)
        candidates = normal_rooms if is_gen else computer_rooms
        fallback_candidates = computer_rooms if is_gen else normal_rooms

        assigned_room = None
        # 1. Try to find one preferred room for all slots of this course
        for room in candidates:
            if all(room.id not in occupied[(a.day, a.period)] for idx, a in slots):
                assigned_room = room
                break

        if assigned_room:
            for idx, a in slots:
                result[idx] = assigned_room.id
                occupied[(a.day, a.period)].add(assigned_room.id)
        else:
            # 2. Fallback to slot-by-slot assignment
            for idx, a in slots:
                slot_room = None

                # Try preferred room type first
                for room in candidates:
                    if room.id not in occupied[(a.day, a.period)]:
                        slot_room = room
                        break

                # 3. CRITICAL FIX: Fallback to the OTHER room type if preferred is full
                if not slot_room:
                    for room in fallback_candidates:
                        if room.id not in occupied[(a.day, a.period)]:
                            slot_room = room
                            break

                if slot_room:
                    result[idx] = slot_room.id
                    occupied[(a.day, a.period)].add(slot_room.id)
                else:
                    failed += 1

    if failed:
        print(f"  WARNING – {failed} lessons failed to find ANY room (Total capacity exceeded)!")
    return result


# ─── cost function ────────────────────────────────────────────────────────────
# ─── cost function ────────────────────────────────────────────────────────────

def _compute_cost(
        assignments: list[SlotAssignment],
        qualified_teachers: dict,
        homeroom_subject_id: int | None,
        class_head: dict,
        pe_subjects: set,
        subjects_dict: dict,
        num_comp_rooms: int,
        num_total_rooms: int
) -> float:
    cost = 0.0
    class_slots: dict[tuple, list] = defaultdict(list)
    teacher_slots: dict[tuple, list] = defaultdict(list)
    class_day_periods: dict[tuple, list] = defaultdict(list)
    teacher_day_periods: dict[tuple, list] = defaultdict(list)

    slot_usage = defaultdict(lambda: {"comp": 0, "total": 0})

    for a in assignments:
        class_slots[(a.class_id, a.day, a.period)].append(a)
        teacher_slots[(a.teacher_id, a.day, a.period)].append(a)
        class_day_periods[(a.class_id, a.day)].append(a.period)
        teacher_day_periods[(a.teacher_id, a.day)].append(a.period)

        subj = subjects_dict.get(a.subject_id)
        if subj:
            if not is_general_subject(subj.name, a.group_id):
                slot_usage[(a.day, a.period)]["comp"] += 1
        slot_usage[(a.day, a.period)]["total"] += 1

    # 1. HARD CONFLICTS: Room capacities (1,000,000 penalty)
    for counts in slot_usage.values():
        if counts["comp"] > num_comp_rooms:
            cost += 1000000 * (counts["comp"] - num_comp_rooms)
        if counts["total"] > num_total_rooms:
            cost += 1000000 * (counts["total"] - num_total_rooms)

    # 2. HARD CONFLICTS: Overlaps for students (1,000,000 penalty)
    for v in class_slots.values():
        if len(v) > 1:
            groups = [x.group_id for x in v]
            has_duplicates = len(groups) != len(set(groups))
            if has_duplicates:
                cost += 1000000 * (len(v) - 1)
            elif not (all(g in (11, 12, 13) for g in groups) or all(g in (1, 2) for g in groups)):
                cost += 1000000 * (len(v) - 1)

    # 3. HARD CONFLICTS: Overlaps for teachers (1,000,000 penalty)
    for v in teacher_slots.values():
        if len(v) > 1:
            cost += 1000000 * (len(v) - 1)

    # 4. Homeroom exact placement
    if homeroom_subject_id is not None:
        for a in assignments:
            if a.subject_id == homeroom_subject_id:
                if a.day != HOMEROOM_DAY or a.period != HOMEROOM_PERIOD:
                    cost += 50000
                if class_head.get(a.class_id) != a.teacher_id:
                    cost += 50000

    # 5. Teacher schedule gaps
    for (teacher_id, day), periods in teacher_day_periods.items():
        if not periods: continue
        periods_sorted = sorted(set(periods))
        if len(periods_sorted) > 1:
            gaps = periods_sorted[-1] - periods_sorted[0] - (len(periods_sorted) - 1)
            cost += gaps * 50

    # 6. TARGETED COMPRESSION: Minimize Student Gaps and 8th+ Periods
    for (class_id, day), periods in class_day_periods.items():
        if not periods: continue
        periods_sorted = sorted(set(periods))

        # Penalize gaps firmly, but not enough to cause room double-booking
        if len(periods_sorted) > 1:
            gaps = periods_sorted[-1] - periods_sorted[0] - (len(periods_sorted) - 1)
            cost += gaps * 10000

            # Penalize late periods (Index 7 is the 8th period)
        for p in periods:
            if p >= 7:
                # Escalating penalty for 8th, 9th, 10th period etc.
                cost += (p - 6) * 5000

                # 7. Sync Sets strict timing
    for sync_tuple in SYNC_SETS:
        sync_slots = defaultdict(lambda: defaultdict(set))
        for a in assignments:
            if a.group_id in sync_tuple:
                sync_slots[a.class_id][a.group_id].add((a.day, a.period))

        for c_id, groups_map in sync_slots.items():
            active_groups = list(groups_map.keys())
            if len(active_groups) > 1:
                base_slots = groups_map[active_groups[0]]
                for g in active_groups[1:]:
                    diff = base_slots.symmetric_difference(groups_map[g])
                    cost += 50000 * len(diff)

    return cost

# ─── initial solution builder ─────────────────────────────────────────────────

def _build_initial_solution(curriculum, qualified_teachers, homeroom_subject_id, class_head):
    assignments = []
    normal_curr = []
    sync_curr = {sync_tuple: defaultdict(list) for sync_tuple in SYNC_SETS}

    course_teachers = {}
    for curr in curriculum:
        key = (curr.class_id, curr.subject_id, curr.group_id)
        teachers = list(qualified_teachers.get(curr.subject_id, []))

        if homeroom_subject_id and curr.subject_id == homeroom_subject_id:
            head = class_head.get(curr.class_id)
            teachers = [head] if head else []

        if teachers:
            course_teachers[key] = random.choice(teachers)

    for curr in curriculum:
        if curr.group_id == -1:
            continue
        synced = False
        for sync_tuple in SYNC_SETS:
            if curr.group_id in sync_tuple:
                sync_curr[sync_tuple][curr.class_id].append(curr)
                synced = True
                break
        if not synced:
            normal_curr.append(curr)

    for curr in normal_curr:
        c_id, s_id, hours, g_id = curr.class_id, curr.subject_id, curr.hours_per_week, curr.group_id
        key = (c_id, s_id, g_id)

        if key not in course_teachers: continue
        t_id = course_teachers[key]

        for _ in range(hours):
            if homeroom_subject_id and s_id == homeroom_subject_id:
                d, p = HOMEROOM_DAY, HOMEROOM_PERIOD
            else:
                # Start initial solution biased towards early morning
                d, p = random.randint(0, NUM_DAYS - 1), random.randint(0, min(5, NUM_PERIODS - 1))
            assignments.append(SlotAssignment(c_id, s_id, t_id, d, p, g_id))

    for sync_tuple in SYNC_SETS:
        for c_id, currs in sync_curr[sync_tuple].items():
            hours_map = {c: c.hours_per_week for c in currs}
            if not hours_map: continue

            max_hours = max(hours_map.values())
            for _ in range(max_hours):
                d, p = random.randint(0, NUM_DAYS - 1), random.randint(0, min(5, NUM_PERIODS - 1))

                for c in currs:
                    if hours_map[c] > 0:
                        key = (c_id, c.subject_id, c.group_id)
                        if key in course_teachers:
                            assignments.append(SlotAssignment(c_id, c.subject_id, course_teachers[key], d, p, c.group_id))
                            hours_map[c] -= 1

    return assignments


def _random_move(assignments, qualified_teachers, homeroom_subject_id, class_head):
    import copy
    new_assignments = copy.copy(assignments)
    moveable = [i for i, a in enumerate(new_assignments) if
                not (homeroom_subject_id and a.subject_id == homeroom_subject_id)]

    if not moveable: return new_assignments

    move_type = random.random()
    if move_type < 0.45:
        idx = random.choice(moveable)
        a = new_assignments[idx]

        sync_ids = None
        for s in SYNC_SETS:
            if a.group_id in s:
                sync_ids = s
                break

        linked = [i for i, x in enumerate(new_assignments)
                  if x.class_id == a.class_id and x.group_id in sync_ids and x.day == a.day and x.period == a.period] \
                  if sync_ids else [idx]

        new_d, new_p = random.randint(0, NUM_DAYS - 1), random.randint(0, NUM_PERIODS - 1)
        for i in linked:
            old = new_assignments[i]
            new_assignments[i] = SlotAssignment(old.class_id, old.subject_id, old.teacher_id, new_d, new_p, old.group_id)

    elif move_type < 0.90:
        if len(moveable) >= 2:
            idx1, idx2 = random.sample(moveable, 2)
            a1, a2 = new_assignments[idx1], new_assignments[idx2]

            sync1 = next((s for s in SYNC_SETS if a1.group_id in s), None)
            sync2 = next((s for s in SYNC_SETS if a2.group_id in s), None)

            linked1 = [i for i, x in enumerate(new_assignments) if x.class_id == a1.class_id and x.group_id in sync1 and x.day == a1.day and x.period == a1.period] if sync1 else [idx1]
            linked2 = [i for i, x in enumerate(new_assignments) if x.class_id == a2.class_id and x.group_id in sync2 and x.day == a2.day and x.period == a2.period] if sync2 else [idx2]

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
            new_t = random.choice(teachers)
            for i in range(len(new_assignments)):
                if new_assignments[i].key == a.key:
                    old = new_assignments[i]
                    new_assignments[i] = SlotAssignment(old.class_id, old.subject_id, new_t, old.day, old.period, old.group_id)

    return new_assignments


# ─── simulated annealing ──────────────────────────────────────────────────────

def _simulated_annealing(
    curriculum: list,
    qualified_teachers: dict,
    homeroom_subject_id: int | None,
    class_head: dict,
    pe_subjects: set,
    subjects_dict: dict,
    num_comp_rooms: int,
    num_total_rooms: int
) -> list[SlotAssignment]:

    current = _build_initial_solution(curriculum, qualified_teachers, homeroom_subject_id, class_head)
    current_cost = _compute_cost(current, qualified_teachers, homeroom_subject_id, class_head, pe_subjects, subjects_dict, num_comp_rooms, num_total_rooms)

    best        = current
    best_cost   = current_cost
    temp        = SA_INITIAL_TEMP
    start       = time.time()
    iteration   = 0

    print(f"  SA start – initial cost: {current_cost:.1f}")

    while temp > SA_MIN_TEMP and (time.time() - start) < SA_MAX_SECONDS:
        for _ in range(SA_ITERATIONS_PER_TEMP):
            neighbour = _random_move(current, qualified_teachers, homeroom_subject_id, class_head)
            neighbour_cost = _compute_cost(neighbour, qualified_teachers, homeroom_subject_id, class_head, pe_subjects, subjects_dict, num_comp_rooms, num_total_rooms)
            delta = neighbour_cost - current_cost

            if delta < 0 or random.random() < math.exp(-delta / temp):
                current      = neighbour
                current_cost = neighbour_cost
                if current_cost < best_cost:
                    best      = current
                    best_cost = current_cost

        temp     *= SA_COOLING_RATE
        iteration += 1

    elapsed = time.time() - start
    print(f"  SA done  – best cost: {best_cost:.1f} | {iteration:,} steps | {elapsed:.1f}s")
    return best


# ─── public entry point ───────────────────────────────────────────────────────

def run_solver(sa_seconds: float = SA_MAX_SECONDS):
    print("=" * 60)
    print("SmartSchedule Solver starting (Compression Mode)...")
    print("=" * 60)

    db: Session = SessionLocal()
    try:
        classes    = db.query(models.Class).all()
        rooms      = db.query(models.Room).all()
        curriculum = db.query(models.ClassCurriculum).all()
        ts_rows    = db.query(models.TeacherSubject).all()

        subjects = db.query(models.Subject).all()
        subjects_dict = {s.id: s for s in subjects}

        num_comp_rooms = len([r for r in rooms if r.has_computers])
        num_total_rooms = len(rooms)

        pe_subjects = {s.id for s in subjects if "физическо" in s.name.lower()}
        up_seen = defaultdict(int)

        for curr in curriculum:
            subj = subjects_dict.get(curr.subject_id)
            if subj:
                name_lower = subj.name.lower()
                words = name_lower.replace('-', ' ').replace('.', ' ').split()

                if "бел" in words or "български" in words or "фвис" in words or "физическо" in words:
                    curr.group_id = 0
                elif any(w.startswith("испанск") for w in words):
                    curr.group_id = 11
                elif any(w.startswith("немск") for w in words):
                    curr.group_id = 12
                elif any(w.startswith("китайск") for w in words):
                    curr.group_id = 13
                elif "уп" in words:
                    count = up_seen[curr.class_id]
                    if count == 0:
                        curr.group_id = 1
                        up_seen[curr.class_id] += 1
                    elif count == 1:
                        curr.group_id = 2
                        up_seen[curr.class_id] += 1
                    else:
                        curr.group_id = 0

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

        print("\n[Phase 1] Simulated Annealing (Compression Mode)...")
        # NOTE: Bypassed CP-SAT completely for this run to let SA freely compress.
        # CP-SAT struggles heavily with "minimize max period" without complex IntervalVars.
        sa_solution = _simulated_annealing(
            curriculum, qualified_teachers, homeroom_id, class_head, pe_subjects,
            subjects_dict, num_comp_rooms, num_total_rooms
        )

        final_solution = sa_solution

        print("\n[Phase 2] Assigning rooms...")
        room_map = _assign_rooms(final_solution, rooms, subjects_dict)

        print("\n[Phase 3] Writing to database...")
        db.query(models.TimetableRecord).delete()

        records = []
        for idx, a in enumerate(final_solution):
            room_id = room_map.get(idx)
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
package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.*;
import com.zlatev.smartschedule.repository.GradeRepository;
import com.zlatev.smartschedule.repository.RoomRepository;
import com.zlatev.smartschedule.repository.TeacherRepository;
import com.zlatev.smartschedule.repository.TimetableRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ScheduleGeneratorAlgorithmImpl implements ScheduleGeneratorAlgorithm {
    private final TimetableRecordRepository timetableRecordRepository;
    private final GradeRepository gradeRepository;
    private final TeacherRepository teacherRepository;
    private final RoomRepository roomRepository;
    private final CurriculumService curriculumService;
    private final ScheduleDatabaseService scheduleDatabaseService;

    public ScheduleGeneratorAlgorithmImpl(TimetableRecordRepository timetableRecordRepository, GradeRepository gradeRepository,
                                          TeacherRepository teacherRepository, RoomRepository roomRepository,
                                          CurriculumService curriculumService, ScheduleDatabaseService scheduleDatabaseService) {
        this.timetableRecordRepository = timetableRecordRepository;
        this.gradeRepository = gradeRepository;
        this.teacherRepository = teacherRepository;
        this.roomRepository = roomRepository;
        this.curriculumService = curriculumService;
        this.scheduleDatabaseService = scheduleDatabaseService;
    }

    private static class Course {
        String classCode;
        Subject subject;
        Teacher teacher;
        int totalHours;
        int remainingHours;

        Course(String classCode, Subject subject, int hours) {
            this.classCode = classCode;
            this.subject = subject;
            this.totalHours = hours;
            this.remainingHours = hours;
        }
    }

    private Map<String, Map<String, Object>> generateAllSchedulesCore() {
        System.out.println("🚀 Стартиране на генериране с БЛОК-ЧАСОВЕ (2 по 2)...");
        timetableRecordRepository.deleteAllInBatch();
        try { timetableRecordRepository.resetAutoIncrement(); } catch (Exception ignored) {}

        List<Grade> allGrades = gradeRepository.findAll();
        List<String> allClasses = allGrades.stream().map(Grade::getClassCode).toList();
        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();

        List<Course> allCourses = new ArrayList<>();
        for (String classCode : allClasses) {
            Map<Subject, Integer> curriculum = curriculumService.getCurriculumForClass(classCode);
            for (Map.Entry<Subject, Integer> entry : curriculum.entrySet()) {
                allCourses.add(new Course(classCode, entry.getKey(), entry.getValue()));
            }
        }

        Map<Integer, Integer> teacherHours = new HashMap<>();
        for (Teacher t : allTeachers) teacherHours.put(t.getId(), 0);

        for (Course course : allCourses) {
            List<Teacher> qualified = allTeachers.stream()
                    .filter(t -> t.getSubjects().contains(course.subject))
                    .toList();

            Teacher selectedTeacher = null;
            for (Teacher t : qualified) {
                if (teacherHours.get(t.getId()) + course.totalHours <= 24) {
                    selectedTeacher = t;
                    break;
                }
            }

            if (selectedTeacher == null && !qualified.isEmpty()) {
                selectedTeacher = qualified.stream()
                        .min(Comparator.comparingInt(t -> teacherHours.get(t.getId())))
                        .orElse(null);
            }

            if (selectedTeacher != null) {
                course.teacher = selectedTeacher;
                teacherHours.put(selectedTeacher.getId(), teacherHours.get(selectedTeacher.getId()) + course.totalHours);
            }
        }

        Map<String, ScheduleSlot[][]> classSchedules = new HashMap<>();
        Map<Integer, boolean[][]> teacherBusy = new HashMap<>();
        Map<Integer, boolean[][]> roomBusy = new HashMap<>();

        for (String classCode : allClasses) classSchedules.put(classCode, new ScheduleSlot[5][8]);
        for (Teacher t : allTeachers) teacherBusy.put(t.getId(), new boolean[5][8]);
        for (Room r : allRooms) roomBusy.put(r.getRoomId(), new boolean[5][8]);

        // ФАЗА 0: Час на класа и Слети езици
        for (String classCode : allClasses) {
            Grade grade = allGrades.stream().filter(g -> g.getClassCode().equals(classCode)).findFirst().orElse(null);
            Teacher homeroomTeacher = (grade != null) ? grade.getClassTeacher() : null;

            Course homeroomCourse = allCourses.stream()
                    .filter(c -> c.classCode.equals(classCode) && c.subject.getSubjectName().trim().equalsIgnoreCase("Час На Класа"))
                    .findFirst().orElse(null);

            if (homeroomCourse != null && homeroomTeacher != null) {
                homeroomCourse.teacher = homeroomTeacher;
                Room availableRoom = getAvailableRoom(allRooms, roomBusy, 0, 6);
                if (availableRoom != null) {
                    placeSlot(classSchedules, teacherBusy, roomBusy, homeroomCourse, availableRoom, 0, 6);
                }
            }
        }

        Set<String> processedPairs = new HashSet<>();
        for (String class1 : allClasses) {
            String class2 = getPairedClassCode(class1);
            if (class2 == null || !allClasses.contains(class2)) continue;

            String pairKey = (class1.compareTo(class2) < 0) ? class1 + "-" + class2 : class2 + "-" + class1;
            if (processedPairs.contains(pairKey)) continue;
            processedPairs.add(pairKey);

            Course span1 = findCourseByKeyword(allCourses, class1, "Испански");
            Course ger1 = findCourseByKeyword(allCourses, class1, "Немски");
            Course span2 = findCourseByKeyword(allCourses, class2, "Испански");
            Course ger2 = findCourseByKeyword(allCourses, class2, "Немски");

            if (span1 == null || ger1 == null || span1.teacher == null || ger1.teacher == null) continue;

            int remainingLanguages = Math.min(span1.totalHours, ger1.totalHours);

            while (remainingLanguages > 0) {
                boolean scheduled = false;
                List<Integer> bestDays = Arrays.asList(0, 1, 2, 3, 4);
                bestDays.sort(Comparator.comparingInt(d -> countFilledSlots(classSchedules.get(class1)[d])));

                boolean tryBlock = remainingLanguages >= 2;

                for (int day : bestDays) {
                    if (scheduled) break;

                    // Опит за БЛОК за езици
                    if (tryBlock) {
                        for (int period = 0; period < 6 && !scheduled; period++) {
                            if (classSchedules.get(class1)[day][period] == null && classSchedules.get(class2)[day][period] == null &&
                                    classSchedules.get(class1)[day][period+1] == null && classSchedules.get(class2)[day][period+1] == null &&
                                    !teacherBusy.get(span1.teacher.getId())[day][period] && !teacherBusy.get(ger1.teacher.getId())[day][period] &&
                                    !teacherBusy.get(span1.teacher.getId())[day][period+1] && !teacherBusy.get(ger1.teacher.getId())[day][period+1]) {

                                Room spanRoom = getAvailableRoomForBlock(allRooms, roomBusy, day, period, period+1);
                                Room gerRoom = null;
                                for(Room r : allRooms) {
                                    if (spanRoom != null && r.getRoomId() == spanRoom.getRoomId()) continue;
                                    if (!roomBusy.get(r.getRoomId())[day][period] && !roomBusy.get(r.getRoomId())[day][period+1]) {
                                        gerRoom = r; break;
                                    }
                                }

                                if (spanRoom != null && gerRoom != null) {
                                    ScheduleSlot s1 = new ScheduleSlot(span1.subject, span1.teacher, spanRoom, ger1.subject, ger1.teacher, gerRoom);
                                    classSchedules.get(class1)[day][period] = s1;
                                    classSchedules.get(class2)[day][period] = s1;
                                    classSchedules.get(class1)[day][period+1] = s1;
                                    classSchedules.get(class2)[day][period+1] = s1;

                                    teacherBusy.get(span1.teacher.getId())[day][period] = true; teacherBusy.get(ger1.teacher.getId())[day][period] = true;
                                    teacherBusy.get(span1.teacher.getId())[day][period+1] = true; teacherBusy.get(ger1.teacher.getId())[day][period+1] = true;
                                    roomBusy.get(spanRoom.getRoomId())[day][period] = true; roomBusy.get(gerRoom.getRoomId())[day][period] = true;
                                    roomBusy.get(spanRoom.getRoomId())[day][period+1] = true; roomBusy.get(gerRoom.getRoomId())[day][period+1] = true;

                                    span1.remainingHours -= 2; ger1.remainingHours -= 2;
                                    if (span2 != null) span2.remainingHours -= 2;
                                    if (ger2 != null) ger2.remainingHours -= 2;

                                    remainingLanguages -= 2;
                                    scheduled = true;
                                }
                            }
                        }
                    }

                    // Единичен час за езици
                    if (!scheduled) {
                        for (int period = 0; period < 7 && !scheduled; period++) {
                            if (classSchedules.get(class1)[day][period] != null || classSchedules.get(class2)[day][period] != null) continue;
                            if (teacherBusy.get(span1.teacher.getId())[day][period] || teacherBusy.get(ger1.teacher.getId())[day][period]) continue;

                            Room r1 = null, r2 = null;
                            for (Room r : allRooms) {
                                if (!roomBusy.get(r.getRoomId())[day][period]) {
                                    if (r1 == null) r1 = r;
                                    else { r2 = r; break; }
                                }
                            }

                            if (r1 != null && r2 != null) {
                                ScheduleSlot splitSlot = new ScheduleSlot(span1.subject, span1.teacher, r1, ger1.subject, ger1.teacher, r2);
                                classSchedules.get(class1)[day][period] = splitSlot;
                                classSchedules.get(class2)[day][period] = splitSlot;

                                teacherBusy.get(span1.teacher.getId())[day][period] = true; teacherBusy.get(ger1.teacher.getId())[day][period] = true;
                                roomBusy.get(r1.getRoomId())[day][period] = true; roomBusy.get(r2.getRoomId())[day][period] = true;

                                span1.remainingHours--; ger1.remainingHours--;
                                if (span2 != null) span2.remainingHours--;
                                if (ger2 != null) ger2.remainingHours--;

                                remainingLanguages--;
                                scheduled = true;
                            }
                        }
                    }
                }
            }
        }

        allCourses.sort((c1, c2) -> Integer.compare(c2.totalHours, c1.totalHours));

        // ФАЗА 2: ОСНОВНО РЕДЕНЕ С БЛОК-ЧАСОВЕ
        for (Course course : allCourses) {
            if (course.teacher == null || course.remainingHours <= 0) continue;

            int maxHoursPerDay = Math.max(2, (int) Math.ceil(course.totalHours / 5.0));

            while (course.remainingHours > 0) {
                boolean placed = false;
                List<Integer> bestDays = Arrays.asList(0, 1, 2, 3, 4);
                bestDays.sort(Comparator.comparingInt(d -> countFilledSlots(classSchedules.get(course.classCode)[d])));

                boolean tryBlock = course.remainingHours >= 2;

                for (int day : bestDays) {
                    if (placed) break;
                    if (countSubjectToday(classSchedules.get(course.classCode)[day], course.subject) >= maxHoursPerDay) continue;

                    // 1. ОПИТ ЗА БЛОК ОТ 2 ЧАСА
                    if (tryBlock && countSubjectToday(classSchedules.get(course.classCode)[day], course.subject) + 2 <= Math.max(2, maxHoursPerDay)) {
                        for (int period = 0; period < 6 && !placed; period++) {
                            if (classSchedules.get(course.classCode)[day][period] == null &&
                                    classSchedules.get(course.classCode)[day][period + 1] == null &&
                                    !teacherBusy.get(course.teacher.getId())[day][period] &&
                                    !teacherBusy.get(course.teacher.getId())[day][period + 1]) {

                                // Търсим 1 стая, която е свободна и за двата часа
                                Room sameRoom = getAvailableRoomForBlock(allRooms, roomBusy, day, period, period + 1);

                                if (sameRoom != null) {
                                    placeSlot(classSchedules, teacherBusy, roomBusy, course, sameRoom, day, period);
                                    placeSlot(classSchedules, teacherBusy, roomBusy, course, sameRoom, day, period + 1);
                                    placed = true;
                                } else {
                                    // Ако няма същата стая, взимаме две различни стаи
                                    Room room1 = getAvailableRoom(allRooms, roomBusy, day, period);
                                    Room room2 = getAvailableRoom(allRooms, roomBusy, day, period + 1);
                                    if (room1 != null && room2 != null) {
                                        placeSlot(classSchedules, teacherBusy, roomBusy, course, room1, day, period);
                                        placeSlot(classSchedules, teacherBusy, roomBusy, course, room2, day, period + 1);
                                        placed = true;
                                    }
                                }
                            }
                        }
                    }

                    // 2. АКО НЕ УСПЕЕМ С БЛОК ИЛИ Е ОСТАНАЛ САМО 1 ЧАС -> ЕДИНИЧЕН
                    if (!placed) {
                        for (int period = 0; period < 7 && !placed; period++) {
                            if (classSchedules.get(course.classCode)[day][period] != null) continue;
                            if (teacherBusy.get(course.teacher.getId())[day][period]) continue;

                            Room availableRoom = getAvailableRoom(allRooms, roomBusy, day, period);
                            if (availableRoom != null) {
                                placeSlot(classSchedules, teacherBusy, roomBusy, course, availableRoom, day, period);
                                placed = true;
                            }
                        }
                    }
                }

                if (!placed) {
                    for (int day : bestDays) {
                        if (placed) break;
                        if (countSubjectToday(classSchedules.get(course.classCode)[day], course.subject) >= maxHoursPerDay) continue;

                        int period = 7;
                        if (classSchedules.get(course.classCode)[day][period] == null &&
                                !teacherBusy.get(course.teacher.getId())[day][period]) {
                            Room availableRoom = getAvailableRoom(allRooms, roomBusy, day, period);
                            if (availableRoom != null) {
                                placeSlot(classSchedules, teacherBusy, roomBusy, course, availableRoom, day, period);
                                placed = true;
                            }
                        }
                    }
                }

                if (!placed) {
                    System.out.println("❌ НЕВЪЗМОЖНО ПОСТАВЯНЕ: Останаха " + course.remainingHours +
                            " часа по " + course.subject.getSubjectName() + " за " + course.classCode);
                    break;
                }
            }
        }

        compactSchedules(allClasses, classSchedules, teacherBusy, roomBusy);

        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        Map<String, Map<String, Object>> finalResult = new HashMap<>();

        for (String classCode : allClasses) {
            Map<String, Object> weeklySchedule = new LinkedHashMap<>();
            for (int d = 0; d < 5; d++) {
                weeklySchedule.put(days[d], Arrays.asList(classSchedules.get(classCode)[d]).subList(0, 8));
            }
            scheduleDatabaseService.saveClassScheduleToDatabase(classCode, weeklySchedule);
            finalResult.put(classCode, weeklySchedule);
        }
        System.out.println("✅ Генерирането приключи!");
        return finalResult;
    }

    private int countFilledSlots(ScheduleSlot[] dailySchedule) {
        int count = 0;
        for (ScheduleSlot scheduleSlot : dailySchedule) {
            if (scheduleSlot != null) count++;
        }
        return count;
    }

    private Room getAvailableRoomForBlock(List<Room> allRooms, Map<Integer, boolean[][]> roomBusy, int day, int period1, int period2) {
        for (Room r : allRooms) {
            if (!roomBusy.get(r.getRoomId())[day][period1] && !roomBusy.get(r.getRoomId())[day][period2]) {
                return r;
            }
        }
        return null;
    }

    private String getPairedClassCode(String classCode) {
        if (classCode == null || classCode.length() < 3) return null;
        String prefix = classCode.substring(0, classCode.length() - 1);
        char lastDigit = classCode.charAt(classCode.length() - 1);
        return switch (lastDigit) {
            case '1' -> prefix + "2"; case '2' -> prefix + "1"; case '3' -> prefix + "5";
            case '5' -> prefix + "3"; case '4' -> prefix + "6"; case '6' -> prefix + "4";
            default -> null;
        };
    }

    private Course findCourseByKeyword(List<Course> allCourses, String classCode, String keyword) {
        return allCourses.stream()
                .filter(c -> c.classCode.equals(classCode) && c.subject.getSubjectName().toLowerCase().contains(keyword.toLowerCase()))
                .findFirst().orElse(null);
    }

    private Room getAvailableRoom(List<Room> allRooms, Map<Integer, boolean[][]> roomBusy, int day, int period) {
        for (Room r : allRooms) {
            if (!roomBusy.get(r.getRoomId())[day][period]) return r;
        }
        return null;
    }

    private void placeSlot(Map<String, ScheduleSlot[][]> classSchedules, Map<Integer, boolean[][]> teacherBusy,
                           Map<Integer, boolean[][]> roomBusy, Course course, Room availableRoom, int day, int period) {
        classSchedules.get(course.classCode)[day][period] = new ScheduleSlot(course.subject, course.teacher, availableRoom);
        teacherBusy.get(course.teacher.getId())[day][period] = true;
        roomBusy.get(availableRoom.getRoomId())[day][period] = true;
        course.remainingHours--;
    }

    private int countSubjectToday(ScheduleSlot[] dailySchedule, Subject subject) {
        int count = 0;
        for (ScheduleSlot slot : dailySchedule) {
            if (slot != null) {
                if (slot.getSubject() != null && slot.getSubject().getSubjectId() == subject.getSubjectId()) count++;
                if (slot.getSubject2() != null && slot.getSubject2().getSubjectId() == subject.getSubjectId()) count++;
            }
        }
        return count;
    }

    @Override
    @Transactional
    public void generateAndSaveAllClasses() { generateAllSchedulesCore(); }

    @Override
    @Transactional
    public Map<String, Object> generateScheduleForClass(String classCode) { return new HashMap<>(); }


    @Override
    public boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject) { return countSubjectToday(daySchedule, subject) > 0; }

    private void compactSchedules(List<String> allClasses, Map<String, ScheduleSlot[][]> classSchedules,
                                  Map<Integer, boolean[][]> teacherBusy, Map<Integer, boolean[][]> roomBusy) {
        System.out.println("🧹 Започва премахване на дупките (сгъстяване на програмата)...");
        boolean changed;
        do {
            changed = false;
            for (String classCode : allClasses) {
                for (int day = 0; day < 5; day++) {
                    // Търсим дупка (свободен час от 0 до 6)
                    for (int period = 0; period < 7; period++) {
                        if (classSchedules.get(classCode)[day][period] == null) {

                            // Намерили сме дупка. Търсим следващ час в същия ден, който да дръпнем напред
                            for (int next = period + 1; next < 8; next++) {
                                ScheduleSlot slotToMove = classSchedules.get(classCode)[day][next];
                                if (slotToMove != null) {
                                    // Можем ли да го преместим тук? (Свободни ли са учителите и стаите)
                                    boolean canMove = true;

                                    // Проверка за основния учител и стая
                                    if (teacherBusy.get(slotToMove.getTeacher().getId())[day][period]) canMove = false;
                                    if (canMove && roomBusy.get(slotToMove.getRoom().getRoomId())[day][period]) canMove = false;

                                    // Проверка за втори учител/стая (при слети класове като езиците)
                                    if (canMove && slotToMove.getTeacher2() != null) {
                                        if (teacherBusy.get(slotToMove.getTeacher2().getId())[day][period]) canMove = false;
                                        if (roomBusy.get(slotToMove.getRoom2().getRoomId())[day][period]) canMove = false;
                                    }

                                    if (canMove) {
                                        // МЕСТИМ ГО!
                                        classSchedules.get(classCode)[day][period] = slotToMove;
                                        classSchedules.get(classCode)[day][next] = null;

                                        // Обновяваме масивите за заетост (освобождаваме стария час, заемаме новия)
                                        teacherBusy.get(slotToMove.getTeacher().getId())[day][next] = false;
                                        teacherBusy.get(slotToMove.getTeacher().getId())[day][period] = true;
                                        roomBusy.get(slotToMove.getRoom().getRoomId())[day][next] = false;
                                        roomBusy.get(slotToMove.getRoom().getRoomId())[day][period] = true;

                                        if (slotToMove.getTeacher2() != null) {
                                            teacherBusy.get(slotToMove.getTeacher2().getId())[day][next] = false;
                                            teacherBusy.get(slotToMove.getTeacher2().getId())[day][period] = true;
                                            roomBusy.get(slotToMove.getRoom2().getRoomId())[day][next] = false;
                                            roomBusy.get(slotToMove.getRoom2().getRoomId())[day][period] = true;
                                        }
                                        changed = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } while (changed);
    }
}
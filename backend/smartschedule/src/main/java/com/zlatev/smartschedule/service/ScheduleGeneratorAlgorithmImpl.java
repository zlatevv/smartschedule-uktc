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
    private final ResourceAllocationService resourceAllocationService;
    private final CurriculumService curriculumService;
    private final ScheduleDatabaseService scheduleDatabaseService;

    public ScheduleGeneratorAlgorithmImpl(TimetableRecordRepository timetableRecordRepository, GradeRepository gradeRepository, TeacherRepository teacherRepository, RoomRepository roomRepository, ResourceAllocationService resourceAllocationService, CurriculumService curriculumService, ScheduleDatabaseService scheduleDatabaseService) {
        this.timetableRecordRepository = timetableRecordRepository;
        this.gradeRepository = gradeRepository;
        this.teacherRepository = teacherRepository;
        this.roomRepository = roomRepository;
        this.resourceAllocationService = resourceAllocationService;
        this.curriculumService = curriculumService;
        this.scheduleDatabaseService = scheduleDatabaseService;
    }

    @Override
    public Map<String, Object> generateScheduleForClass(String classCode) {
        System.out.println("Генериране на програма само за клас " + classCode);

        Map<String, Set<Integer>> busyTeacherIds = new HashMap<>();
        Map<String, Set<Integer>> busyRoomIds = new HashMap<>();

        List<TimetableRecord> allExistingRecords = timetableRecordRepository.findAll();
        for (TimetableRecord record : allExistingRecords) {
            if (record.getClassCode().equals(classCode)) {
                continue;
            }
            String timeKey = record.getDayOfWeek() + "-" + record.getPeriod();

            if (record.getTeacher() != null) {
                busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(record.getTeacher().getId());
            }
            if (record.getRoom() != null) {
                busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(record.getRoom().getRoomId());
            }
        }

        // Подаваме null за prefilledGrid, защото генерираме само един клас
        return generateScheduleForClassInternal(classCode, busyTeacherIds, busyRoomIds, null);
    }

    private Map<String, Object> generateScheduleForClassInternal(String classCode, Map<String, Set<Integer>> busyTeacherIds,
                                                                 Map<String, Set<Integer>> busyRoomIds, ScheduleSlot[][] prefilledGrid) {
        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();

        Map<Subject, Integer> curriculum = new HashMap<>(curriculumService.getCurriculumForClass(classCode));
        Map<Subject, Integer> originalCurriculum = new HashMap<>(curriculum);
        Map<Subject, Teacher> classAssignedTeachers = new HashMap<>();

        Grade currentGrade = gradeRepository.findAll().stream()
                .filter(g -> g.getClassCode().equals(classCode))
                .findFirst()
                .orElse(null);

        Teacher homeroomTeacher = (currentGrade != null) ? currentGrade.getClassTeacher() : null;

        // Ако имаме предварително запазени езици (Фаза 0), ползваме тях, иначе правим празен масив
        ScheduleSlot[][] grid = (prefilledGrid != null) ? prefilledGrid : new ScheduleSlot[5][8];
        int[] hoursPerDay = new int[5];

        // МНОГО ВАЖНО: Махаме от нужните часове тези, които вече сме сложили във Фаза 0
        for (int d = 0; d < 5; d++) {
            for (int p = 0; p < 8; p++) {
                if (grid[d][p] != null) {
                    Subject s1 = grid[d][p].getSubject();
                    if (s1 != null && curriculum.containsKey(s1)) {
                        curriculum.put(s1, curriculum.get(s1) - 1);
                    }
                    Subject s2 = grid[d][p].getSubject2(); // Ако е слят клас
                    if (s2 != null && curriculum.containsKey(s2)) {
                        curriculum.put(s2, curriculum.get(s2) - 1);
                    }
                }
            }
        }

        Subject homeroomSubject = null;
        for (Subject s : curriculum.keySet()) {
            if (s.getSubjectName().trim().equalsIgnoreCase("Час На Класа")) {
                homeroomSubject = s;
                break;
            }
        }

        // ТВЪРДО ЗАДАВАНЕ НА ЧАСА НА КЛАСА ЗА ПОНЕДЕЛНИК 7-МИ ЧАС (Индекс 0, 6)
        if (homeroomSubject != null && homeroomTeacher != null && grid[0][6] == null) {
            Room homeroomRoom = resourceAllocationService.findAvailableRoom(homeroomSubject, allRooms, 0, 6, 1, busyRoomIds);

            if (homeroomRoom != null) {
                grid[0][6] = new ScheduleSlot(homeroomSubject, homeroomTeacher, homeroomRoom);
                busyTeacherIds.computeIfAbsent("0-6", k -> new HashSet<>()).add(homeroomTeacher.getId());
                busyRoomIds.computeIfAbsent("0-6", k -> new HashSet<>()).add(homeroomRoom.getRoomId());

                classAssignedTeachers.put(homeroomSubject, homeroomTeacher);
                curriculum.remove(homeroomSubject);
                originalCurriculum.remove(homeroomSubject);
                System.out.println("✅ Час на класа е заложен в Понеделник 7-ми час за " + classCode);
            }
        }

        List<Map.Entry<Subject, Integer>> sortedSubjects = new ArrayList<>(curriculum.entrySet());
        sortedSubjects.sort((a, b) -> b.getValue().compareTo(a.getValue()));

        // --- ФАЗА 1: Строго подреждане без дупки (до 7-ми час, нормални лимити) ---
        runPhase(grid, hoursPerDay, sortedSubjects, originalCurriculum, allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, 7, 0, false);

        // --- ФАЗА 2: Отпускане на лимита на ден (до 7-ми час, БЕЗ дупки) ---
        runPhase(grid, hoursPerDay, sortedSubjects, originalCurriculum, allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, 7, 2, false);

        // --- ФАЗА 3: Позволяване на 8-ми час (БЕЗ дупки) ---
        runPhase(grid, hoursPerDay, sortedSubjects, originalCurriculum, allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, 8, 10, false);

        // --- ФАЗА 4: Крайно спасяване (Позволява дупки, само при безизходица) ---
        runPhase(grid, hoursPerDay, sortedSubjects, originalCurriculum, allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, 8, 10, true);

        for (Map.Entry<Subject, Integer> entry : sortedSubjects) {
            if (entry.getValue() > 0) {
                System.out.println("⚠️ Няма свободно място/учител/стая в програмата за: " + entry.getKey().getSubjectName() + " (Остават " + entry.getValue() + " часа) в клас " + classCode);
            }
        }

        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        Map<String, Object> weeklySchedule = new LinkedHashMap<>();

        for (int d = 0; d < 5; d++) {
            List<ScheduleSlot> dailySlots = new ArrayList<>(Arrays.asList(grid[d]).subList(0, 8));
            weeklySchedule.put(days[d], dailySlots);
        }

        return weeklySchedule;
    }

    @Override
    @Transactional
    public void generateAndSaveAllClasses() {
        System.out.println("Стартиране на масово генериране за всички класове...");
        timetableRecordRepository.deleteAllInBatch();

        try {
            timetableRecordRepository.resetAutoIncrement();
        } catch (Exception e) {
            System.out.println("⚠️ Внимание: Неуспешно ресетиране на брояча, продължаваме...");
        }

        List<String> allClasses = gradeRepository.findAll().stream()
                .map(Grade::getClassCode)
                .sorted((class1, class2) -> {
                    int num1 = extractGradeNumber(class1);
                    int num2 = extractGradeNumber(class2);

                    int vipusk1 = num1 / 10;
                    int paralelk1 = num1 % 10;
                    int vipusk2 = num2 / 10;
                    int paralelk2 = num2 % 10;

                    if (vipusk1 != vipusk2) {
                        return Integer.compare(vipusk2, vipusk1);
                    }
                    return Integer.compare(paralelk1, paralelk2);
                })
                .toList();

        Map<String, Set<Integer>> globalBusyTeacherIds = new HashMap<>();
        Map<String, Set<Integer>> globalBusyRoomIds = new HashMap<>();

        // --- ФАЗА 0: Подготовка на предварителни графици за слетите паралелки ---
        Map<String, ScheduleSlot[][]> prefilledGrids = new HashMap<>();
        for (String classCode : allClasses) {
            prefilledGrids.put(classCode, new ScheduleSlot[5][8]);
        }

        schedulePairedLanguagesPhaseZero(allClasses, prefilledGrids, globalBusyTeacherIds, globalBusyRoomIds);
        // --- КРАЙ НА ФАЗА 0 ---

        for (String classCode : allClasses) {
            Map<String, Object> classSchedule = generateScheduleForClassInternal(classCode, globalBusyTeacherIds, globalBusyRoomIds, prefilledGrids.get(classCode));
            scheduleDatabaseService.saveClassScheduleToDatabase(classCode, classSchedule);
        }

        System.out.println("✅ Масовото генериране и запазване приключи успешно!");
    }

    // --- ЛОГИКА ЗА ФАЗА 0 (СЛЕТИ ПАРАЛЕЛКИ) ---
    private void schedulePairedLanguagesPhaseZero(List<String> allClasses, Map<String, ScheduleSlot[][]> prefilledGrids,
                                                  Map<String, Set<Integer>> globalBusyTeacherIds, Map<String, Set<Integer>> globalBusyRoomIds) {
        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();
        Set<String> processedPairs = new HashSet<>();

        for (String class1 : allClasses) {
            String class2 = getPairedClassCode(class1);
            if (class2 == null || !allClasses.contains(class2)) continue;

            // За да не обработваме 251-252, а после и 252-251
            String pairKey = (class1.compareTo(class2) < 0) ? class1 + "-" + class2 : class2 + "-" + class1;
            if (processedPairs.contains(pairKey)) continue;
            processedPairs.add(pairKey);

            Map<Subject, Integer> curr1 = curriculumService.getCurriculumForClass(class1);

            Subject spanish = findSubjectByKeyword(curr1.keySet(), "Испански");
            Subject german = findSubjectByKeyword(curr1.keySet(), "Немски");

            if (spanish == null || german == null) continue;

            // Взимаме часовете (предполагаме, че са еднакви за двата езика)
            int hoursToSchedule = Math.min(curr1.getOrDefault(spanish, 0), curr1.getOrDefault(german, 0));

            for (int h = 0; h < hoursToSchedule; h++) {
                boolean scheduled = false;
                for (int day = 0; day < 5 && !scheduled; day++) {
                    for (int period = 0; period < 7 && !scheduled; period++) { // Търсим до 7-ми час
                        String timeKey = day + "-" + period;

                        if (prefilledGrids.get(class1)[day][period] != null || prefilledGrids.get(class2)[day][period] != null) continue;

                        Teacher t1 = resourceAllocationService.findAvailableTeacher(spanish, allTeachers, day, period, 1, globalBusyTeacherIds);
                        if (t1 != null) {
                            globalBusyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(t1.getId());
                            Teacher t2 = resourceAllocationService.findAvailableTeacher(german, allTeachers, day, period, 1, globalBusyTeacherIds);

                            if (t2 != null) {
                                Room r1 = resourceAllocationService.findAvailableRoom(spanish, allRooms, day, period, 1, globalBusyRoomIds);
                                if (r1 != null) {
                                    globalBusyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(r1.getRoomId());
                                    Room r2 = resourceAllocationService.findAvailableRoom(german, allRooms, day, period, 1, globalBusyRoomIds);

                                    if (r2 != null) {
                                        // УСПЕХ! Имаме 2 свободни учители и 2 свободни стаи!
                                        globalBusyTeacherIds.get(timeKey).add(t2.getId());
                                        globalBusyRoomIds.get(timeKey).add(r2.getRoomId());

                                        ScheduleSlot splitSlot = new ScheduleSlot(spanish, t1, r1, german, t2, r2);
                                        prefilledGrids.get(class1)[day][period] = splitSlot;
                                        prefilledGrids.get(class2)[day][period] = splitSlot;
                                        scheduled = true;
                                        System.out.println("🔗 Езици ЗАКАЧЕНИ за " + class1 + " и " + class2 + " (Ден: " + day + ", Час: " + period + ")");
                                        continue;
                                    } else {
                                        globalBusyRoomIds.get(timeKey).remove(r1.getRoomId()); // Rollback стая 1
                                    }
                                }
                            }
                            globalBusyTeacherIds.get(timeKey).remove(t1.getId()); // Rollback учител 1
                        }
                    }
                }
            }
        }
    }

    // Помощен метод за намиране на "другарчето" (1 с 2, 3 с 5, 4 с 6)
    private String getPairedClassCode(String classCode) {
        if (classCode == null || classCode.length() < 3) return null;
        String prefix = classCode.substring(0, classCode.length() - 1);
        char lastDigit = classCode.charAt(classCode.length() - 1);

        return switch (lastDigit) {
            case '1' -> prefix + "2";
            case '2' -> prefix + "1";
            case '3' -> prefix + "5";
            case '5' -> prefix + "3";
            case '4' -> prefix + "6";
            case '6' -> prefix + "4";
            default -> null;
        };
    }

    // Помощен метод за намиране на предмет по част от името
    private Subject findSubjectByKeyword(Set<Subject> subjects, String keyword) {
        for (Subject s : subjects) {
            if (s.getSubjectName().toLowerCase().contains(keyword.toLowerCase())) {
                return s;
            }
        }
        return null;
    }
    // --- КРАЙ НА ЛОГИКАТА ЗА ФАЗА 0 ---

    private void runPhase(ScheduleSlot[][] grid, int[] hoursPerDay, List<Map.Entry<Subject, Integer>> sortedSubjects,
                          Map<Subject, Integer> originalCurriculum, List<Teacher> allTeachers, List<Room> allRooms,
                          Map<String, Set<Integer>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds,
                          Map<Subject, Teacher> classAssignedTeachers, int maxPeriodsForDay, int maxAllowedRelaxation, boolean allowGaps) {
        boolean progressMade;
        do {
            progressMade = false;
            for (Map.Entry<Subject, Integer> entry : sortedSubjects) {
                int remainingHours = entry.getValue();
                if (remainingHours <= 0) continue;

                Subject subject = entry.getKey();
                int totalWeeklyHours = originalCurriculum.getOrDefault(subject, remainingHours);
                int maxAllowedPerDay = getMaxAllowedPerDay(totalWeeklyHours) + maxAllowedRelaxation;
                int blockLength = (remainingHours >= 2) ? 2 : 1;

                boolean placed;
                if (!allowGaps) {
                    placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, maxAllowedPerDay,
                            allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, maxPeriodsForDay);
                    if (!placed && blockLength == 2) {
                        blockLength = 1;
                        placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, maxAllowedPerDay,
                                allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, maxPeriodsForDay);
                    }
                } else {
                    placed = placeBlockWithGaps(grid, subject, blockLength, maxAllowedPerDay,
                            allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, maxPeriodsForDay);
                    if (!placed && blockLength == 2) {
                        blockLength = 1;
                        placed = placeBlockWithGaps(grid, subject, blockLength, maxAllowedPerDay,
                                allTeachers, allRooms, busyTeacherIds, busyRoomIds, classAssignedTeachers, maxPeriodsForDay);
                    }
                }

                if (placed) {
                    entry.setValue(remainingHours - blockLength);
                    progressMade = true;
                }
            }
        } while (progressMade);
    }

    @Override
    public boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration,
                                         int maxAllowedPerDay, List<Teacher> allTeachers, List<Room> allRooms,
                                         Map<String, Set<Integer>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds,
                                         Map<Subject, Teacher> classAssignedTeachers, int maxPeriodsForDay) {
        List<Integer> days = Arrays.asList(0, 1, 2, 3, 4);
        Collections.shuffle(days);
        days.sort(Comparator.comparingInt(d -> countOccupiedSlots(grid[d])));

        Teacher requiredTeacher = classAssignedTeachers.get(subject);
        List<Teacher> allowedTeachers = (requiredTeacher != null) ? Collections.singletonList(requiredTeacher) : allTeachers;

        for (int day : days) {
            if (countSubjectOnDay(grid[day], subject) + duration > maxAllowedPerDay) {
                continue;
            }

            int startPeriod = findFirstFreePeriod(grid[day], maxPeriodsForDay);
            if (startPeriod == -1 || startPeriod + duration > maxPeriodsForDay) {
                continue;
            }

            boolean canFit = true;
            for (int i = 0; i < duration; i++) {
                if (grid[day][startPeriod + i] != null) {
                    canFit = false;
                    break;
                }
            }

            if (!canFit) {
                continue;
            }

            Teacher availableTeacher = resourceAllocationService.findAvailableTeacher(subject, allowedTeachers, day, startPeriod, duration, busyTeacherIds);
            Room availableRoom = resourceAllocationService.findAvailableRoom(subject, allRooms, day, startPeriod, duration, busyRoomIds);

            if (availableTeacher == null || availableRoom == null) {
                continue;
            }

            if (requiredTeacher == null) {
                classAssignedTeachers.put(subject, availableTeacher);
            }

            for (int i = 0; i < duration; i++) {
                int currentPeriod = startPeriod + i;
                grid[day][currentPeriod] = new ScheduleSlot(subject, availableTeacher, availableRoom);

                String timeKey = day + "-" + currentPeriod;
                busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableTeacher.getId());
                busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableRoom.getRoomId());
            }

            return true;
        }
        return false;
    }

    private boolean placeBlockWithGaps(ScheduleSlot[][] grid, Subject subject, int duration,
                                       int maxAllowedPerDay, List<Teacher> allTeachers, List<Room> allRooms,
                                       Map<String, Set<Integer>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds,
                                       Map<Subject, Teacher> classAssignedTeachers, int maxPeriodsForDay) {
        List<Integer> days = Arrays.asList(0, 1, 2, 3, 4);
        days.sort(Comparator.comparingInt(d -> countOccupiedSlots(grid[d])));

        Teacher requiredTeacher = classAssignedTeachers.get(subject);
        List<Teacher> allowedTeachers = (requiredTeacher != null) ? Collections.singletonList(requiredTeacher) : allTeachers;

        for (int day : days) {
            if (countSubjectOnDay(grid[day], subject) + duration > maxAllowedPerDay) {
                continue;
            }

            for (int startPeriod = 0; startPeriod <= maxPeriodsForDay - duration; startPeriod++) {

                boolean slotsFree = true;
                for (int i = 0; i < duration; i++) {
                    if (grid[day][startPeriod + i] != null) {
                        slotsFree = false;
                        break;
                    }
                }
                if (!slotsFree) continue;

                Teacher availableTeacher = resourceAllocationService.findAvailableTeacher(subject, allowedTeachers, day, startPeriod, duration, busyTeacherIds);
                Room availableRoom = resourceAllocationService.findAvailableRoom(subject, allRooms, day, startPeriod, duration, busyRoomIds);

                if (availableTeacher != null && availableRoom != null) {

                    if (requiredTeacher == null) {
                        classAssignedTeachers.put(subject, availableTeacher);
                    }

                    for (int i = 0; i < duration; i++) {
                        int currentPeriod = startPeriod + i;
                        grid[day][currentPeriod] = new ScheduleSlot(subject, availableTeacher, availableRoom);

                        String timeKey = day + "-" + currentPeriod;
                        busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableTeacher.getId());
                        busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableRoom.getRoomId());
                    }
                    return true;
                }
            }
        }
        return false;
    }

    @Override
    public boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject) {
        return countSubjectOnDay(daySchedule, subject) > 0;
    }

    private int countSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject) {
        int count = 0;
        for (ScheduleSlot slot : daySchedule) {
            if (slot != null) {
                if (slot.getSubject() != null && slot.getSubject().getSubjectId() == subject.getSubjectId()) {
                    count++;
                }
                // Проверяваме и втория предмет, ако е слят слот
                if (slot.getSubject2() != null && slot.getSubject2().getSubjectId() == subject.getSubjectId()) {
                    count++;
                }
            }
        }
        return count;
    }

    private int countOccupiedSlots(ScheduleSlot[] daySchedule) {
        int count = 0;
        for (int i = 0; i <= 7; i++) {
            if (daySchedule[i] != null) count++;
        }
        return count;
    }

    private int getMaxAllowedPerDay(int totalWeeklyHours) {
        if (totalWeeklyHours >= 15) return 4;
        if (totalWeeklyHours >= 8) return 3;
        return 2;
    }

    private int findFirstFreePeriod(ScheduleSlot[] daySchedule, int maxPeriods) {
        for (int i = 0; i < maxPeriods; i++) {
            if (daySchedule[i] == null) {
                return i;
            }
        }
        return -1;
    }

    private int extractGradeNumber(String classCode) {
        String numberOnly = classCode.replaceAll("[^0-9]", "");
        if (numberOnly.isEmpty()) {
            return 0;
        }
        return Integer.parseInt(numberOnly);
    }
}
package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.*;
import com.zlatev.smartschedule.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional; // <-- Импорт за транзакциите

import java.util.*;
import java.util.stream.Collectors; // <-- Импорт за списъците

@Service
public class ScheduleGeneratorService {

    @Autowired
    private SubjectRepository subjectRepository;
    @Autowired
    private TeacherRepository teacherRepository;
    @Autowired
    private RoomRepository roomRepository;
    @Autowired
    private GradeCurriculumRepository gradeCurriculumRepository;
    @Autowired
    private TimetableRecordRepository timetableRepository;

    // ВАЖНО: Добавяме Repository за класовете, за да вземем всички класове от базата.
    // Ако при теб се казва SchoolClassRepository или нещо друго, промени го тук!
    @Autowired
    private GradeRepository gradeRepository;

    // =======================================================
    // 1. НОВ МЕТОД: МАСОВО ГЕНЕРИРАНЕ ЗА ВСИЧКИ КЛАСОВЕ
    // =======================================================
    @Transactional
    public void generateAndSaveAllClasses() {
        System.out.println("Стартиране на масово генериране за всички класове...");

        // 1. Изчистваме старата програма от базата данни
        timetableRepository.deleteAll();

        // 2. Взимаме всички класове от базата и ги сортираме низходящо (12, 11, 10...)
        // Забележка: Ако методът ти в Entity-то не е getClassCode(), промени го тук.
        List<String> allClasses = gradeRepository.findAll().stream()
                .map(Grade::getClassCode)
                .sorted(Collections.reverseOrder())
                .toList();

        // 3. Завъртаме цикъла за всеки клас
        for (String classCode : allClasses) {
            // Генерираме програмата чрез твоя основен метод
            Map<String, Object> classSchedule = generateScheduleForClass(classCode);

            // Веднага я запазваме в базата, за да се отрази като "заета" за следващия клас
            saveClassScheduleToDatabase(classCode, classSchedule);
        }

        System.out.println("✅ Масовото генериране и запазване приключи успешно!");
    }

    // =======================================================
    // 2. НОВ МЕТОД: ПОМОЩНО ЗАПАЗВАНЕ В БАЗАТА
    // =======================================================
    private void saveClassScheduleToDatabase(String classCode, Map<String, Object> classSchedule) {
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};

        for (int d = 0; d < 5; d++) {
            String dayName = days[d];

            @SuppressWarnings("unchecked")
            List<ScheduleSlot> dailySlots = (List<ScheduleSlot>) classSchedule.get(dayName);

            if (dailySlots == null) continue;

            for (int p = 0; p < 7; p++) {
                if (p >= dailySlots.size()) break;

                ScheduleSlot slot = dailySlots.get(p);

                // Ако в часа има предмет, записваме го
                if (slot != null && slot.getSubject() != null) {
                    TimetableRecord record = new TimetableRecord();
                    record.setClassCode(classCode);
                    record.setDayOfWeek(d);
                    record.setPeriod(p); // В бекенда часовете ти са от 0 до 6
                    record.setSubject(slot.getSubject());
                    record.setTeacher(slot.getTeacher());
                    record.setRoom(slot.getRoom());

                    timetableRepository.save(record);
                }
            }
        }
    }

    // =======================================================
    // 3. ТВОЯТ ОСНОВЕН МЕТОД ЗА 1 КЛАС
    // =======================================================
    public Map<String, Object> generateScheduleForClass(String classCode) {
        System.out.println("Генериране на умна програма за клас " + classCode);

        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();
        Map<Subject, Integer> curriculum = getCurriculumForClass(classCode);

        // 1. Зареждаме вече запазените програми
        List<TimetableRecord> allExistingRecords = timetableRepository.findAll();
        Map<String, Set<Long>> busyTeacherIds = new HashMap<>();
        Map<String, Set<Integer>> busyRoomIds = new HashMap<>();

        for (TimetableRecord record : allExistingRecords) {
            if (record.getClassCode().equals(classCode)) {
                continue;
            }
            String timeKey = record.getDayOfWeek() + "-" + record.getPeriod();

            if (record.getTeacher() != null) {
                busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add((long) record.getTeacher().getId());
            }
            if (record.getRoom() != null) {
                busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(record.getRoom().getRoomId());
            }
        }

        // 2. Инициализираме празна мрежа (5 дни, 7 часа)
        ScheduleSlot[][] grid = new ScheduleSlot[5][7];
        int[] hoursPerDay = new int[5];

        // --- ТВЪРДО ЗАЛАГАНЕ НА "ЧАС НА КЛАСА" (ID 49) ---
        Subject homeroomSubject = null;
        for (Subject s : curriculum.keySet()) {
            if (s.getSubjectId() == 49) {
                homeroomSubject = s;
                break;
            }
        }

        if (homeroomSubject != null) {
            Teacher homeroomTeacher = findAvailableTeacher(homeroomSubject, allTeachers, 0, 6, 1, busyTeacherIds);
            Room homeroomRoom = findAvailableRoom(homeroomSubject, allRooms, 0, 6, 1, busyRoomIds);

            // ЗАЩИТА: Проверяваме дали сме намерили учител и стая!
            if (homeroomTeacher != null && homeroomRoom != null) {
                grid[0][6] = new ScheduleSlot(homeroomSubject, homeroomTeacher, homeroomRoom);
                busyTeacherIds.computeIfAbsent("0-6", k -> new HashSet<>()).add((long) homeroomTeacher.getId());
                busyRoomIds.computeIfAbsent("0-6", k -> new HashSet<>()).add(homeroomRoom.getRoomId());

                curriculum.remove(homeroomSubject);
                System.out.println("✅ Час на класа е заложен успешно в Понеделник 7-ми час.");
            } else {
                System.out.println("⚠️ ВНИМАНИЕ: Не е намерен свободен учител или стая за Час на класа в Понеделник 7-ми час!");
            }
        }
        // --------------------------------------------------------

        // 3. Сортираме останалите предмети низходящо по брой часове
        List<Map.Entry<Subject, Integer>> sortedSubjects = new ArrayList<>(curriculum.entrySet());
        sortedSubjects.sort((a, b) -> b.getValue().compareTo(a.getValue()));

        // 4. Разполагаме предметите
        for (Map.Entry<Subject, Integer> entry : sortedSubjects) {
            Subject subject = entry.getKey();
            int remainingHours = entry.getValue();

            boolean allowMultiplePerDay = remainingHours > 5;

            while (remainingHours > 0) {
                int blockLength = (remainingHours >= 2) ? 2 : 1;

                boolean placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, allowMultiplePerDay,
                        allTeachers, allRooms, busyTeacherIds, busyRoomIds);

                if (!placed && blockLength == 2) {
                    blockLength = 1;
                    placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, allowMultiplePerDay,
                            allTeachers, allRooms, busyTeacherIds, busyRoomIds);
                }

                if (placed) {
                    remainingHours -= blockLength;
                } else {
                    System.out.println("⚠️ Няма свободно място/учител/стая в програмата за: " + subject.getSubjectName());
                    break;
                }
            }
        }

        // 5. Конвертираме към Map за фронтенда
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        Map<String, Object> weeklySchedule = new LinkedHashMap<>();

        for (int d = 0; d < 5; d++) {
            List<ScheduleSlot> dailySlots = new ArrayList<>(Arrays.asList(grid[d]).subList(0, 7));
            weeklySchedule.put(days[d], dailySlots);
        }

        return weeklySchedule;
    }

    // --- ЛОГИКА ЗА ПОСТАВЯНЕ БЕЗ ДУПКИ И С ПРОВЕРКА ЗА ЗАЕТОСТ ---

    private boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration, boolean allowMultiple,
                                          List<Teacher> allTeachers, List<Room> allRooms,
                                          Map<String, Set<Long>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds) {

        List<Integer> days = Arrays.asList(0, 1, 2, 3, 4);
        Collections.shuffle(days);
        days.sort(Comparator.comparingInt(d -> hoursPerDay[d])); // Избираме най-празния ден

        for (int day : days) {
            int maxPeriodsForDay = (day == 0) ? 6 : 7;

            if (hoursPerDay[day] + duration <= maxPeriodsForDay) {

                if (!allowMultiple && hasSubjectOnDay(grid[day], subject)) {
                    continue;
                }

                int startPeriod = hoursPerDay[day];

                Teacher availableTeacher = findAvailableTeacher(subject, allTeachers, day, startPeriod, duration, busyTeacherIds);
                Room availableRoom = findAvailableRoom(subject, allRooms, day, startPeriod, duration, busyRoomIds);

                if (availableTeacher == null || availableRoom == null) {
                    continue;
                }

                for (int i = 0; i < duration; i++) {
                    int currentPeriod = startPeriod + i;
                    grid[day][currentPeriod] = new ScheduleSlot(subject, availableTeacher, availableRoom);

                    String timeKey = day + "-" + currentPeriod;
                    busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add((long) availableTeacher.getId());
                    busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableRoom.getRoomId());
                }

                hoursPerDay[day] += duration;
                return true;
            }
        }

        return false;
    }

    private boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject) {
        for (ScheduleSlot slot : daySchedule) {
            if (slot != null && slot.getSubject() != null && slot.getSubject().getSubjectId() == subject.getSubjectId()) {
                return true;
            }
        }
        return false;
    }

    private Teacher findAvailableTeacher(Subject subject, List<Teacher> allTeachers, int day, int startPeriod, int duration, Map<String, Set<Long>> busyTeacherIds) {
        return allTeachers.stream()
                .filter(t -> t.getSubjects().stream().anyMatch(s -> s.getSubjectId() == subject.getSubjectId()))
                .filter(t -> {
                    for (int i = 0; i < duration; i++) {
                        String timeKey = day + "-" + (startPeriod + i);
                        if (busyTeacherIds.getOrDefault(timeKey, new HashSet<>()).contains(t.getId())) {
                            return false;
                        }
                    }
                    return true;
                })
                .findFirst()
                .orElse(null);
    }

    // =======================================================
    // 4. НОВИЯТ "УМЕН" ИЗБОР НА СТАИ
    // =======================================================
    private Room findAvailableRoom(Subject subject, List<Room> allRooms, int day, int startPeriod, int duration, Map<String, Set<Integer>> busyRoomIds) {
        String name = subject.getSubjectName().toLowerCase();

        // Ъпдейтнат списък с ключови думи за компютърни кабинети
        boolean needsComputers = name.contains("ит") || name.contains("информационни") ||
                name.contains("програмиране") || name.contains("ооп") ||
                name.contains("софтуер") || name.contains("бази данни") || name.contains("уеб") ||
                name.contains("уп");

        // ПРАВИЛО ЗА УДОБСТВО: Сортираме стаите предварително
        List<Room> preferredRooms = new ArrayList<>(allRooms);
        preferredRooms.sort((r1, r2) -> {
            boolean r1IsFloor4 = String.valueOf(r1.getRoomId()).startsWith("4");
            boolean r2IsFloor4 = String.valueOf(r2.getRoomId()).startsWith("4");

            if (!needsComputers) {
                if (r1IsFloor4 && !r2IsFloor4) return -1;
                if (!r1IsFloor4 && r2IsFloor4) return 1;
            } else {
                // За компютърните предпочитаме 3-ти етаж
                boolean r1IsFloor3 = String.valueOf(r1.getRoomId()).startsWith("3");
                boolean r2IsFloor3 = String.valueOf(r2.getRoomId()).startsWith("3");
                if (r1IsFloor3 && !r2IsFloor3) return -1;
                if (!r1IsFloor3 && r2IsFloor3) return 1;
            }
            return 0;
        });

        // Търсим първата СВОБОДНА стая
        return preferredRooms.stream()
                .filter(r -> r.isHasComputers() == needsComputers)
                .filter(r -> {
                    for (int i = 0; i < duration; i++) {
                        String timeKey = day + "-" + (startPeriod + i);
                        if (busyRoomIds.getOrDefault(timeKey, new HashSet<>()).contains(r.getRoomId())) {
                            return false;
                        }
                    }
                    return true;
                })
                .findFirst()
                .orElse(null);
    }

    private int determineGradeLevel(String classCode) {
        if (classCode == null || classCode.length() < 2) {
            throw new IllegalArgumentException("Invalid class code format");
        }

        char gradeIdentifier = classCode.charAt(1);

        return switch (gradeIdentifier) {
            case '5' -> 8;
            case '4' -> 9;
            case '3' -> 10;
            case '2' -> 11;
            case '1' -> 12;
            default -> throw new IllegalArgumentException("Unknown grade level for class code: " + classCode);
        };
    }

    private Map<Subject, Integer> getCurriculumForClass(String classCode) {
        Map<Subject, Integer> curriculumMap = new HashMap<>();
        int gradeLevel = determineGradeLevel(classCode);
        List<GradeCurriculum> gradePlan = gradeCurriculumRepository.findByGradeLevel(gradeLevel);

        for (GradeCurriculum plan : gradePlan) {
            curriculumMap.put(plan.getSubject(), plan.getHoursPerWeek());
        }

        return curriculumMap;
    }
    @Transactional
    public void saveManualSchedule(List<Map<String, Object>> scheduleData) {
        if (scheduleData == null || scheduleData.isEmpty()) {
            return;
        }

        // 1. Взимаме кода на класа (напр. "8а") от първия запис
        String classCode = scheduleData.get(0).get("classCode").toString();

        // (По желание) Тук е хубаво да изтриеш старата програма на този клас,
        // за да не се дублират часовете при повторно запазване:
        // timetableRecordRepository.deleteByClassCode(classCode);

        List<TimetableRecord> recordsToSave = new ArrayList<>();

        // 2. Въртим през всеки изпратен час от фронтенда
        for (Map<String, Object> data : scheduleData) {
            TimetableRecord record = new TimetableRecord();
            record.setClassCode(data.get("classCode").toString());
            record.setDayOfWeek(Integer.parseInt(data.get("dayOfWeek").toString()));
            record.setPeriod(Integer.parseInt(data.get("period").toString()));

            // 3. Търсим Предмета по име в базата
            String subjectName = (String) data.get("subjectName");
            if (subjectName != null && !subjectName.isEmpty()) {
                // ВНИМАНИЕ: Трябва да имаш метод findBySubjectName(String name) в SubjectRepository!
                subjectRepository.findBySubjectName(subjectName).ifPresent(record::setSubject);
            }

            // 4. Търсим Учителя по име
            String teacherName = (String) data.get("teacherName");
            if (teacherName != null && !teacherName.isEmpty()) {
                // ВНИМАНИЕ: Трябва да имаш метод findByName(String name) в TeacherRepository!
                teacherRepository.findByName(teacherName).ifPresent(record::setTeacher);
            }

            // 5. Търсим Стаята по име/номер
            String roomName = (String) data.get("roomName");
            if (roomName != null && !roomName.isEmpty()) {
                // Адаптирай според това как търсиш стаите (по име или ID)
                // roomRepository.findByName(roomName).ifPresent(record::setRoom);
            }

            recordsToSave.add(record);
        }
        timetableRepository.saveAll(recordsToSave);
        System.out.println("====== " + recordsToSave.size() + " ЧАСА СА ЗАПИСАНИ В БАЗАТА! ======");
    }
}
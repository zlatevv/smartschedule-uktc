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
        // Този метод се вика от фронтенда, ако генерираме само 1 конкретен клас
        System.out.println("Генериране на програма само за клас " + classCode);

        Map<String, Set<Long>> busyTeacherIds = new HashMap<>();
        Map<String, Set<Integer>> busyRoomIds = new HashMap<>();

        List<TimetableRecord> allExistingRecords = timetableRecordRepository.findAll();
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

        return generateScheduleForClassInternal(classCode, busyTeacherIds, busyRoomIds);
    }

    // ВЪТРЕШЕН МЕТОД: Тук става магията. Той приема паметта и работи директно с нея!
    private Map<String, Object> generateScheduleForClassInternal(String classCode, Map<String, Set<Long>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds) {
        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();

        Map<Subject, Integer> curriculum = new HashMap<>(curriculumService.getCurriculumForClass(classCode));

        Grade currentGrade = gradeRepository.findAll().stream()
                .filter(g -> g.getClassCode().equals(classCode))
                .findFirst()
                .orElse(null);

        Teacher homeroomTeacher = (currentGrade != null) ? currentGrade.getClassTeacher() : null;

        ScheduleSlot[][] grid = new ScheduleSlot[5][8];
        int[] hoursPerDay = new int[5];

        Subject homeroomSubject = null;
        for (Subject s : curriculum.keySet()) {
            if (s.getSubjectName().trim().equalsIgnoreCase("Час На Класа")) {
                homeroomSubject = s;
                break;
            }
        }

        if (homeroomSubject != null && homeroomTeacher != null) {
            Room homeroomRoom = resourceAllocationService.findAvailableRoom(homeroomSubject, allRooms, 0, 6, 1, busyRoomIds);

            if (homeroomRoom != null) {
                grid[0][6] = new ScheduleSlot(homeroomSubject, homeroomTeacher, homeroomRoom);
                busyTeacherIds.computeIfAbsent("0-6", k -> new HashSet<>()).add((long) homeroomTeacher.getId());
                busyRoomIds.computeIfAbsent("0-6", k -> new HashSet<>()).add(homeroomRoom.getRoomId());

                curriculum.remove(homeroomSubject);
                System.out.println("✅ Час на класа е заложен в Понеделник 7-ми час за " + classCode);
            }
        }

        List<Map.Entry<Subject, Integer>> sortedSubjects = new ArrayList<>(curriculum.entrySet());
        sortedSubjects.sort((a, b) -> b.getValue().compareTo(a.getValue()));

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

        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        Map<String, Object> weeklySchedule = new LinkedHashMap<>();

        for (int d = 0; d < 5; d++) {
            List<ScheduleSlot> dailySlots = new ArrayList<>(Arrays.asList(grid[d]).subList(0, 7));
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
                .sorted(Collections.reverseOrder())
                .toList();

        // Глобалната памет срещу дублиране
        Map<String, Set<Long>> globalBusyTeacherIds = new HashMap<>();
        Map<String, Set<Integer>> globalBusyRoomIds = new HashMap<>();

        for (String classCode : allClasses) {
            Map<String, Object> classSchedule = generateScheduleForClassInternal(classCode, globalBusyTeacherIds, globalBusyRoomIds);

            scheduleDatabaseService.saveClassScheduleToDatabase(classCode, classSchedule);
        }

        System.out.println("✅ Масовото генериране и запазване приключи успешно!");
    }

    @Override
    public boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration, boolean allowMultiple, List<Teacher> allTeachers, List<Room> allRooms, Map<String, Set<Long>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds) {
        List<Integer> days = Arrays.asList(0, 1, 2, 3, 4);
        Collections.shuffle(days);
        days.sort(Comparator.comparingInt(d -> hoursPerDay[d]));

        for (int day : days) {
            int maxPeriodsForDay = 8;

            if (hoursPerDay[day] + duration <= maxPeriodsForDay) {
                if (!allowMultiple && hasSubjectOnDay(grid[day], subject)) {
                    continue;
                }

                int startPeriod = hoursPerDay[day];

                Teacher availableTeacher = resourceAllocationService.findAvailableTeacher(subject, allTeachers, day, startPeriod, duration, busyTeacherIds);
                Room availableRoom = resourceAllocationService.findAvailableRoom(subject, allRooms, day, startPeriod, duration, busyRoomIds);

                if (availableTeacher == null || availableRoom == null) {
                    continue;
                }

                for (int i = 0; i < duration; i++) {
                    int currentPeriod = startPeriod + i;
                    grid[day][currentPeriod] = new ScheduleSlot(subject, availableTeacher, availableRoom);

                    String timeKey = day + "-" + currentPeriod;
                    // ТУК Е МАГИЯТА: Паметта се обновява на секундата!
                    busyTeacherIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add((long) availableTeacher.getId());
                    busyRoomIds.computeIfAbsent(timeKey, k -> new HashSet<>()).add(availableRoom.getRoomId());
                }

                hoursPerDay[day] += duration;
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject) {
        for (ScheduleSlot slot : daySchedule) {
            if (slot != null && slot.getSubject() != null && slot.getSubject().getSubjectId() == subject.getSubjectId()) {
                return true;
            }
        }
        return false;
    }
}
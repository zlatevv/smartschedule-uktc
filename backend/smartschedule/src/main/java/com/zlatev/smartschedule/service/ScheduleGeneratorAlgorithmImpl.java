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
        System.out.println("Генериране на умна програма за клас " + classCode);

        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();
        Map<Subject, Integer> curriculum = curriculumService.getCurriculumForClass(classCode);

        List<TimetableRecord> allExistingRecords = timetableRecordRepository.findAll();
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

        ScheduleSlot[][] grid = new ScheduleSlot[5][7];
        int[] hoursPerDay = new int[5];

        Subject homeroomSubject = null;
        for (Subject s : curriculum.keySet()) {
            if (s.getSubjectId() == 49) {
                homeroomSubject = s;
                break;
            }
        }

        if (homeroomSubject != null) {
            Teacher homeroomTeacher = resourceAllocationService.findAvailableTeacher(homeroomSubject, allTeachers, 0, 6, 1, busyTeacherIds);
            Room homeroomRoom = resourceAllocationService.findAvailableRoom(homeroomSubject, allRooms, 0, 6, 1, busyRoomIds);

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

    @Override
    @Transactional
    public void generateAndSaveAllClasses() {
        System.out.println("Стартиране на масово генериране за всички класове...");

        timetableRecordRepository.deleteAll();

        List<String> allClasses = gradeRepository.findAll().stream()
                .map(Grade::getClassCode)
                .sorted(Collections.reverseOrder())
                .toList();

        for (String classCode : allClasses) {
            Map<String, Object> classSchedule = generateScheduleForClass(classCode);

            scheduleDatabaseService.saveClassScheduleToDatabase(classCode, classSchedule);
        }

        System.out.println("✅ Масовото генериране и запазване приключи успешно!");
    }

    @Override
    public boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration, boolean allowMultiple, List<Teacher> allTeachers, List<Room> allRooms, Map<String, Set<Long>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds) {
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

                Teacher availableTeacher = resourceAllocationService.findAvailableTeacher(subject, allTeachers, day, startPeriod, duration, busyTeacherIds);
                Room availableRoom = resourceAllocationService.findAvailableRoom(subject, allRooms, day, startPeriod, duration, busyRoomIds);

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

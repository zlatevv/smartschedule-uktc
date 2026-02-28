package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.GradeCurriculum;
import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;
import com.zlatev.smartschedule.repository.GradeCurriculumRepository;
import com.zlatev.smartschedule.repository.RoomRepository;
import com.zlatev.smartschedule.repository.SubjectRepository;
import com.zlatev.smartschedule.repository.TeacherRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

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

    public Map<String, Object> generateScheduleForClass(String classCode) {
        System.out.println("Generating smart, gapless schedule for class " + classCode);

        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();
        Map<Subject, Integer> curriculum = getCurriculumForClass(classCode);

        // 1. Инициализираме празна мрежа (5 дни, 7 часа)
        Subject[][] grid = new Subject[5][7];

        // НОВО: Масив, който пази до кой час е запълнен всеки ден (от 0 до 4 са дните)
        int[] hoursPerDay = new int[5];

        // 2. Сортираме предметите низходящо по брой часове.
        List<Map.Entry<Subject, Integer>> sortedSubjects = new ArrayList<>(curriculum.entrySet());
        sortedSubjects.sort((a, b) -> b.getValue().compareTo(a.getValue()));

        // 3. Разполагаме предметите
        for (Map.Entry<Subject, Integer> entry : sortedSubjects) {
            Subject subject = entry.getKey();
            int remainingHours = entry.getValue();

            // Ако предметът има много часове (напр. Учебна практика), позволяваме да е повече пъти в деня
            boolean allowMultiplePerDay = remainingHours > 5;

            while (remainingHours > 0) {
                // Опитваме се да сложим блок от 2 часа, ако имаме поне 2 часа останали
                int blockLength = (remainingHours >= 2) ? 2 : 1;

                boolean placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, allowMultiplePerDay);

                // Ако не сме успели да сложим блок от 2 часа (напр. денят има място само за 1 час), го разделяме
                if (!placed && blockLength == 2) {
                    blockLength = 1;
                    placed = placeBlockWithoutGaps(grid, hoursPerDay, subject, blockLength, allowMultiplePerDay);
                }

                if (placed) {
                    remainingHours -= blockLength;
                } else {
                    // Предпазител, ако седмицата се препълни (над 35 часа общо)
                    System.out.println("Няма повече място в програмата за: " + subject.getSubjectName());
                    break;
                }
            }
        }

        // 4. Конвертираме към Map за фронтенда
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        Map<String, Object> weeklySchedule = new LinkedHashMap<>();

        for (int d = 0; d < 5; d++) {
            List<ScheduleSlot> dailySlots = new ArrayList<>();
            for (int p = 0; p < 7; p++) {
                Subject s = grid[d][p];
                if (s != null) {
                    Teacher teacher = findTeacherForSubject(s, allTeachers);
                    Room room = findRoomForSubject(s, allRooms);
                    dailySlots.add(new ScheduleSlot(s, teacher, room));
                } else {
                    dailySlots.add(null);
                }
            }
            weeklySchedule.put(days[d], dailySlots);
        }

        return weeklySchedule;
    }

    // --- ОБНОВЕН ПОМОЩЕН МЕТОД ЗА ПЪЛНЕНЕ БЕЗ ДУПКИ ---

    private boolean placeBlockWithoutGaps(Subject[][] grid, int[] hoursPerDay, Subject subject, int duration, boolean allowMultiple) {
        // Създаваме списък с дните (0=Понеделник ... 4=Петък)
        List<Integer> days = Arrays.asList(0, 1, 2, 3, 4);

        // Разбъркваме ги леко, за да има елемент на случайност при равни условия
        Collections.shuffle(days);

        // КЛЮЧОВО: Сортираме дните по това колко са пълни в момента.
        // Винаги ще избираме най-празния ден, за да балансираме седмицата (да нямаме 7 часа в Понеделник и 2 в Петък)
        days.sort(Comparator.comparingInt(d -> hoursPerDay[d]));

        for (int day : days) {
            // Има ли физически място за този блок в този ден? (Макс 7 часа)
            if (hoursPerDay[day] + duration <= 7) {

                // Проверяваме дали предметът вече го има днес (ако не е практика)
                if (!allowMultiple && hasSubjectOnDay(grid[day], subject)) {
                    continue;
                }

                // Слагаме предмета ПЛЪТНО след последния записан час за този ден
                int startPeriod = hoursPerDay[day];
                for (int i = 0; i < duration; i++) {
                    grid[day][startPeriod + i] = subject;
                }

                // Увеличаваме брояча на часовете за този ден
                hoursPerDay[day] += duration;
                return true; // Успешно поставен
            }
        }

        return false; // Не е намерено място
    }

    private boolean hasSubjectOnDay(Subject[] daySchedule, Subject subject) {
        for (Subject s : daySchedule) {
            if (s != null && s.getSubjectId() == subject.getSubjectId()) {
                return true;
            }
        }
        return false;
    }

    // --- Helper Methods ---

    private Teacher findTeacherForSubject(Subject subject, List<Teacher> allTeachers) {
        // Find a teacher who has this subject in their subjects list
        return allTeachers.stream()
                .filter(t -> t.getSubjects().stream().anyMatch(s -> s.getSubjectId() == subject.getSubjectId()))
                .findAny() // In a real app, you'd check availability (no double booking)
                .orElse(new Teacher("Неразпределен"));
    }

    private Room findRoomForSubject(Subject subject, List<Room> allRooms) {
        // If subject is IT/Programming, requires computers
        String name = subject.getSubjectName().toLowerCase();
        boolean needsComputers = name.contains("ит") || name.contains("информационни") ||
                name.contains("програмиране") || name.contains("ооп") ||
                name.contains("софтуер");

        return allRooms.stream()
                .filter(r -> r.isHasComputers() == needsComputers)
                .findAny() // In a real app, you'd check if room is already booked
                .orElse(new Room(0, needsComputers)); // Fallback room
    }

    private int determineGradeLevel(String classCode) {
        if (classCode == null || classCode.length() < 2) {
            throw new IllegalArgumentException("Invalid class code format");
        }

        // Extracting the middle digit to determine the grade
        // Assuming: 25x = 8th grade, 24x = 9th, 23x = 10th, 22x = 11th, 21x = 12th
        char gradeIdentifier = classCode.charAt(1);

        return switch (gradeIdentifier) {
            case '5' -> 8;  // Class 251, 252...
            case '4' -> 9;  // Class 241, 242...
            case '3' -> 10; // Class 231, 232...
            case '2' -> 11; // Class 221, 222...
            case '1' -> 12; // Class 211, 212...
            default -> throw new IllegalArgumentException("Unknown grade level for class code: " + classCode);
        };
    }

    // Now fetch directly using the translated grade level!
    private Map<Subject, Integer> getCurriculumForClass(String classCode) {
        Map<Subject, Integer> curriculumMap = new HashMap<>();

        // 1. Figure out what grade this class is in
        int gradeLevel = determineGradeLevel(classCode);

        // 2. Fetch the standard curriculum for that grade
        List<GradeCurriculum> gradePlan = gradeCurriculumRepository.findByGradeLevel(gradeLevel);

        // 3. Map it out for the algorithm
        for (GradeCurriculum plan : gradePlan) {
            curriculumMap.put(plan.getSubject(), plan.getHoursPerWeek());
        }

        return curriculumMap;
    }
}
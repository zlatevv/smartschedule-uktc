package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ResourceAllocationServiceImpl implements ResourceAllocationService {
    @Override
    public Room findAvailableRoom(Subject subject, List<Room> allRooms, int day, int startPeriod, int duration, Map<String, Set<Integer>> busyRoomIds) {
        String name = subject.getSubjectName().toLowerCase();
        boolean needsComputers = name.contains("ит") || name.contains("информационни") ||
                name.contains("програмиране") || name.contains("ооп") ||
                name.contains("софтуер") || name.contains("бази данни") || name.contains("уеб") ||
                name.contains("уп");

        List<Room> preferredRooms = new ArrayList<>(allRooms);
        preferredRooms.sort((r1, r2) -> {
            boolean r1IsFloor4 = String.valueOf(r1.getRoomId()).startsWith("4");
            boolean r2IsFloor4 = String.valueOf(r2.getRoomId()).startsWith("4");

            if (!needsComputers) {
                if (r1IsFloor4 && !r2IsFloor4) return -1;
                if (!r1IsFloor4 && r2IsFloor4) return 1;
            } else {
                boolean r1IsFloor3 = String.valueOf(r1.getRoomId()).startsWith("3");
                boolean r2IsFloor3 = String.valueOf(r2.getRoomId()).startsWith("3");
                if (r1IsFloor3 && !r2IsFloor3) return -1;
                if (!r1IsFloor3 && r2IsFloor3) return 1;
            }
            return 0;
        });

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

    @Override
    public Teacher findAvailableTeacher(Subject subject, List<Teacher> allTeachers, int day,
                                        int startPeriod, int duration,
                                        Map<String, Set<Integer>> busyTeacherIds) {
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
}

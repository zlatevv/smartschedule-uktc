package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;

import java.util.List;
import java.util.Map;
import java.util.Set;

public interface ScheduleGeneratorAlgorithm {
    Map<String, Object> generateScheduleForClass(String classCode);
    void generateAndSaveAllClasses();
    boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject);
    boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration,
                                  int maxAllowedPerDay, List<Teacher> allTeachers, List<Room> allRooms,
                                  Map<String, Set<Integer>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds,
                                  Map<Subject, Teacher> classAssignedTeachers, int maxPeriodsForDay);
}

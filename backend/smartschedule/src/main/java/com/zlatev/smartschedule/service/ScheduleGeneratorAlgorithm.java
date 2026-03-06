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
    boolean placeBlockWithoutGaps(ScheduleSlot[][] grid, int[] hoursPerDay, Subject subject, int duration, boolean allowMultiple,
                                  List<Teacher> allTeachers, List<Room> allRooms,
                                  Map<String, Set<Long>> busyTeacherIds, Map<String, Set<Integer>> busyRoomIds);
    boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject);
}

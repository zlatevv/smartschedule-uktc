package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;

import java.util.List;
import java.util.Map;
import java.util.Set;

public interface ResourceAllocationService {
    Room findAvailableRoom(Subject subject, List<Room> allRooms, int day, int startPeriod, int duration, Map<String, Set<Integer>> busyRoomIds);
    Teacher findAvailableTeacher(Subject subject, List<Teacher> allTeachers, int day, int startPeriod, int duration, Map<String, Set<Long>> busyTeacherIds);
}

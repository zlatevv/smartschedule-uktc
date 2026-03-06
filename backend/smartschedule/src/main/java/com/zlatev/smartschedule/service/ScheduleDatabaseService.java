package com.zlatev.smartschedule.service;

import java.util.List;
import java.util.Map;

public interface ScheduleDatabaseService {
    void saveClassScheduleToDatabase(String classCode, Map<String, Object> classSchedule);
    void saveManualSchedule(List<Map<String, Object>> scheduleData);
}

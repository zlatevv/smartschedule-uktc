package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.Subject;

import java.util.Map;

public interface ScheduleGeneratorAlgorithm {
    Map<String, Object> generateScheduleForClass(String classCode);
    void generateAndSaveAllClasses();
    boolean hasSubjectOnDay(ScheduleSlot[] daySchedule, Subject subject);
}

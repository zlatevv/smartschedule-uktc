package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.entity.Subject;

import java.util.Map;

public interface CurriculumService {
    int determineGradeLevel(String classCode);
    Map<Subject, Integer> getCurriculumForClass(String classCode);
}

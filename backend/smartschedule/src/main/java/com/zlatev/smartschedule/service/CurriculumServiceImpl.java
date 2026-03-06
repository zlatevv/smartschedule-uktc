package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.entity.GradeCurriculum;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.repository.GradeCurriculumRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CurriculumServiceImpl implements CurriculumService {
    private final GradeCurriculumRepository gradeCurriculumRepository;

    public CurriculumServiceImpl(GradeCurriculumRepository gradeCurriculumRepository) {
        this.gradeCurriculumRepository = gradeCurriculumRepository;
    }

    @Override
    public int determineGradeLevel(String classCode) {
        if (classCode == null || classCode.length() < 2) {
            throw new IllegalArgumentException("Invalid class code format");
        }

        char gradeIdentifier = classCode.charAt(1);

        return switch (gradeIdentifier) {
            case '5' -> 8;
            case '4' -> 9;
            case '3' -> 10;
            case '2' -> 11;
            case '1' -> 12;
            default -> throw new IllegalArgumentException("Unknown grade level for class code: " + classCode);
        };
    }

    @Override
    public Map<Subject, Integer> getCurriculumForClass(String classCode) {
        Map<Subject, Integer> curriculumMap = new HashMap<>();
        int gradeLevel = determineGradeLevel(classCode);
        List<GradeCurriculum> gradePlan = gradeCurriculumRepository.findByGradeLevel(gradeLevel);

        for (GradeCurriculum plan : gradePlan) {
            curriculumMap.put(plan.getSubject(), plan.getHoursPerWeek());
        }

        return curriculumMap;
    }
}

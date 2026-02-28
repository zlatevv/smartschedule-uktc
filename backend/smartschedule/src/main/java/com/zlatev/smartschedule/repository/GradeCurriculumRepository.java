package com.zlatev.smartschedule.repository;

import com.zlatev.smartschedule.entity.GradeCurriculum;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GradeCurriculumRepository extends CrudRepository<GradeCurriculum, Integer> {

    // This will fetch all subjects and their hours for a specific class like "235"
    List<GradeCurriculum> findByGradeLevel(int gradeLevel);
}
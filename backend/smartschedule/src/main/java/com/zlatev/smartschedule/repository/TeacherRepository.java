package com.zlatev.smartschedule.repository;

import com.zlatev.smartschedule.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Integer> {
    Optional<Teacher> findByName(String name);
}

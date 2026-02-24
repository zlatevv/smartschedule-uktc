package com.zlatev.smartschedule.repository;

import com.zlatev.smartschedule.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {
}

package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.entity.Grade;
import com.zlatev.smartschedule.entity.Teacher;
import com.zlatev.smartschedule.repository.GradeRepository;
import com.zlatev.smartschedule.repository.TeacherRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/classes")
@CrossOrigin(origins = "*")
public class GradeController {

    @Autowired
    private GradeRepository gradeRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @GetMapping
    public List<Grade> getAllGrades(){
        return gradeRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> addGrade(@RequestBody Grade grade){
        try {
            // Проверяваме дали въобще идва учител с валидно ID
            if (grade.getClassTeacher() != null && grade.getClassTeacher().getId() != 0) {

                // Търсим учителя по ID
                Optional<Teacher> teacherOpt = teacherRepository.findById(grade.getClassTeacher().getId());

                if (teacherOpt.isPresent()) {
                    grade.setClassTeacher(teacherOpt.get());
                } else {
                    return ResponseEntity.badRequest().body("Учител с това ID не е намерен!");
                }
            } else {
                return ResponseEntity.badRequest().body("Не е подаден валиден класен ръководител (липсва ID)!");
            }

            Grade savedGrade = gradeRepository.save(grade);
            return ResponseEntity.ok(savedGrade);

        } catch (Exception e) {
            // Това ще принтира точната грешка в конзолата на IntelliJ
            e.printStackTrace();
            // Това ще върне грешката към екрана на браузъра ти
            return ResponseEntity.status(500).body("Сървърна грешка: " + e.getMessage());
        }
    }
}
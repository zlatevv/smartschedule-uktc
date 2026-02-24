package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.entity.Grade;
import com.zlatev.smartschedule.repository.GradeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
@CrossOrigin(origins = "*")
public class GradeController {
    @Autowired
    private GradeRepository gradeRepository;

    @GetMapping
    public List<Grade> getAllGrades(){
        return gradeRepository.findAll();
    }

    @PostMapping
    public Grade addGrade(@RequestBody Grade grade){
        return gradeRepository.save(grade);
    }
}

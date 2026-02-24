package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
@CrossOrigin(origins = "*")
public class SubjectController {

    @Autowired
    private SubjectRepository subjectRepository;

    @GetMapping
    public List<Subject> getAllSubjects(){
        return subjectRepository.findAll();
    }

    @PostMapping
    public Subject addSubject(@RequestBody Subject subject){
        return subjectRepository.save(subject);
    }
}

package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.repository.RoomRepository;
import com.zlatev.smartschedule.repository.SubjectRepository;
import com.zlatev.smartschedule.repository.TeacherRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class ScheduleGeneratorService {

    @Autowired
    private SubjectRepository subjectRepository;
    @Autowired
    private TeacherRepository teacherRepository;
    @Autowired
    private RoomRepository roomRepository;

    public Map<String, Object> generateScheduleForClass(String classCode){
        System.out.println("Generating schedule for class " + classCode);

        Map<String, Object> result = new HashMap<>();

        //TODO implement business logic

        return result;
    }
}

package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.service.ScheduleGeneratorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
@CrossOrigin(origins ="*")
public class ScheduleController {

    @Autowired
    private ScheduleGeneratorService scheduleGeneratorService;

    @PostMapping("/generate/{classCode}")
    public Map<String, Object> generate(@PathVariable String classCode){
        return scheduleGeneratorService.generateScheduleForClass(classCode);
    }
}

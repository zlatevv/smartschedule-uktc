package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.service.ScheduleGeneratorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
@CrossOrigin(origins ="*")
public class ScheduleController {

    @Autowired
    private ScheduleGeneratorService scheduleGeneratorService;

    @PostMapping("/generate/{classCode}")
    public ResponseEntity<?> generate(@PathVariable String classCode) {
        System.out.println("====== 1. ВЛЕЗЕ В КОНТРОЛЕРА ЗА КЛАС: " + classCode + " ======");

        try {
            Map<String, Object> schedule = scheduleGeneratorService.generateScheduleForClass(classCode);
            System.out.println("====== 2. ПРОГРАМАТА Е ГЕНЕРИРАНА, ЗАПОЧВА JSON СЕРИАЛИЗАЦИЯ ======");
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            System.out.println("====== ❌ ХВАНАТА ГРЕШКА В КОНТРОЛЕРА! ======");
            e.printStackTrace();
            // Връщаме грешката като JSON, за да може фронтендът да я прочете
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
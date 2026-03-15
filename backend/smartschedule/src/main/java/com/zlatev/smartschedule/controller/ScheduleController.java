package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.service.CurriculumService;
import com.zlatev.smartschedule.service.ScheduleDatabaseService;
import com.zlatev.smartschedule.service.ScheduleGeneratorAlgorithm;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
@CrossOrigin(origins = "*") // Това оправя CORS грешката!
public class ScheduleController {
    private final ScheduleGeneratorAlgorithm scheduleGeneratorService;
    private final ScheduleDatabaseService scheduleDatabaseService;
    private final CurriculumService curriculumService;

    public ScheduleController(ScheduleGeneratorAlgorithm scheduleGeneratorService, ScheduleDatabaseService scheduleDatabaseService, CurriculumService curriculumService) {
        this.scheduleGeneratorService = scheduleGeneratorService;
        this.scheduleDatabaseService = scheduleDatabaseService;
        this.curriculumService = curriculumService;
    }

    // Бутонът "Генерирай" вика това (веднъж!)
    @PostMapping("/generate/all")
    public ResponseEntity<?> generateAll() {
        System.out.println("====== ГЕНЕРИРАНЕ НА ВСИЧКИ КЛАСОВЕ ======");
        try {
            scheduleGeneratorService.generateAndSaveAllClasses();
            return ResponseEntity.ok(Map.of("message", "Програмата за всички класове е готова!"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/save")
    public ResponseEntity<?> saveSchedule(@RequestBody List<Map<String, Object>> scheduleData) {
        System.out.println("====== ПОЛУЧЕНА ЗАЯВКА ЗА ЗАПАЗВАНЕ ======");
        try {
            scheduleDatabaseService.saveManualSchedule(scheduleData);
            return ResponseEntity.ok("Програмата е запазена успешно в базата!");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Грешка при запазване: " + e.getMessage());
        }
    }

    // Падащото меню на фронтенда вика това (само чете!)
    @GetMapping("/class/{classCode}")
    public ResponseEntity<?> getScheduleForClass(@PathVariable String classCode) {
        System.out.println("====== ИЗТЕГЛЯНЕ НА ПРОГРАМА ЗА КЛАС: " + classCode + " ======");
        try {
            Map<String, Object> schedule = scheduleDatabaseService.getClassSchedule(classCode);
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Грешка: " + e.getMessage());
        }
    }
}
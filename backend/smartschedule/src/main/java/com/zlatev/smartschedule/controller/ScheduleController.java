package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.service.CurriculumService;
import com.zlatev.smartschedule.service.ScheduleDatabaseService;
import com.zlatev.smartschedule.service.ScheduleGeneratorAlgorithm;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
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


    // 1. Методът за генериране на ЕДИН конкретен клас (както работи в момента JS-ът ти)
    @PostMapping("/generate/{classCode}")
    public ResponseEntity<?> generateForClass(@PathVariable String classCode) {
        System.out.println("====== 1. ВЛЕЗЕ В КОНТРОЛЕРА ЗА КЛАС: " + classCode + " ======");
        try {
            Map<String, Object> schedule = scheduleGeneratorService.generateScheduleForClass(classCode);
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 2. Методът за генериране на ВСИЧКИ класове (ако решиш да го вържеш към нов бутон)
    @PostMapping("/generate/all")
    public ResponseEntity<?> generateAll() {
        System.out.println("====== ГЕНЕРИРАНЕ НА ВСИЧКИ КЛАСОВЕ ======");
        try {
            // Тук извикваш твоя метод от Service, който върти цикъла за всички класове
            // scheduleGeneratorService.generateAndSaveAllClasses();
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

    @GetMapping("/class/{classCode}")
    public ResponseEntity<?> getScheduleForClass(@PathVariable String classCode) {
        System.out.println("====== ИЗТЕГЛЯНЕ НА ПРОГРАМА ЗА КЛАС: " + classCode + " ======");
        try {
            Map<Subject, Integer> schedule = curriculumService.getCurriculumForClass(classCode);

            Map<String, Integer> formattedSchedule = new HashMap<>();

            for (Map.Entry<Subject, Integer> entry : schedule.entrySet()) {
                String subjectName = entry.getKey().getSubjectName();
                formattedSchedule.put(subjectName, entry.getValue());
            }

            return ResponseEntity.ok(formattedSchedule);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Грешка: " + e.getMessage());
        }
    }
}
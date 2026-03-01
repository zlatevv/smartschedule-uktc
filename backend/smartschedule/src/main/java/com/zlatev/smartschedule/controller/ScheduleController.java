package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.service.ScheduleGeneratorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
@CrossOrigin(origins = "*") // Това оправя CORS грешката!
public class ScheduleController {

    @Autowired
    private ScheduleGeneratorService scheduleGeneratorService;

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

    // 3. ЕТО ГО ЛИПСВАЩИЯТ МЕТОД ЗА ЗАПАЗВАНЕ!
    @PostMapping("/save")
    public ResponseEntity<?> saveSchedule(@RequestBody List<Map<String, Object>> scheduleData) {
        System.out.println("====== ПОЛУЧЕНА ЗАЯВКА ЗА ЗАПАЗВАНЕ ======");
        try {
            // Предаваме данните на Service-а, за да ги обработи и запише
            scheduleGeneratorService.saveManualSchedule(scheduleData);
            return ResponseEntity.ok("Програмата е запазена успешно в базата!");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Грешка при запазване: " + e.getMessage());
        }
    }
}
package com.zlatev.smartschedule.service;

import com.zlatev.smartschedule.dto.ScheduleSlot;
import com.zlatev.smartschedule.entity.TimetableRecord;
import com.zlatev.smartschedule.repository.SubjectRepository;
import com.zlatev.smartschedule.repository.TeacherRepository;
import com.zlatev.smartschedule.repository.TimetableRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ScheduleDatabaseServiceImpl implements ScheduleDatabaseService {
    private final TimetableRecordRepository timetableRecordRepository;
    private final TeacherRepository teacherRepository;
    private final SubjectRepository subjectRepository;

    public ScheduleDatabaseServiceImpl(TimetableRecordRepository timetableRecordRepository,
                                       TeacherRepository teacherRepository,
                                       SubjectRepository subjectRepository) {

        this.timetableRecordRepository = timetableRecordRepository;
        this.teacherRepository = teacherRepository;
        this.subjectRepository = subjectRepository;
    }

    @Override
    public void saveClassScheduleToDatabase(String classCode, Map<String, Object> classSchedule) {
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};

        for (int d = 0; d < 5; d++) {
            String dayName = days[d];

            List<ScheduleSlot> dailySlots = (List<ScheduleSlot>) classSchedule.get(dayName);

            if (dailySlots == null) continue;

            for (int p = 0; p < 7; p++) {
                if (p >= dailySlots.size()) break;

                ScheduleSlot slot = dailySlots.get(p);

                if (slot != null && slot.getSubject() != null) {
                    TimetableRecord record = new TimetableRecord();
                    record.setClassCode(classCode);
                    record.setDayOfWeek(d);
                    record.setPeriod(p);
                    record.setSubject(slot.getSubject());
                    record.setTeacher(slot.getTeacher());
                    record.setRoom(slot.getRoom());

                    timetableRecordRepository.save(record);
                }
            }
        }
    }

    @Override
    @Transactional
    public void saveManualSchedule(List<Map<String, Object>> scheduleData) {
        if (scheduleData == null || scheduleData.isEmpty()) {
            return;
        }

        // 1. Взимаме кода на класа (напр. "8а") от първия запис
        String classCode = scheduleData.get(0).get("classCode").toString();

        // (По желание) Тук е хубаво да изтриеш старата програма на този клас,
        // за да не се дублират часовете при повторно запазване:
        // timetableRecordRepository.deleteByClassCode(classCode);

        List<TimetableRecord> recordsToSave = new ArrayList<>();

        for (Map<String, Object> data : scheduleData) {
            TimetableRecord record = new TimetableRecord();
            record.setClassCode(data.get("classCode").toString());
            record.setDayOfWeek(Integer.parseInt(data.get("dayOfWeek").toString()));
            record.setPeriod(Integer.parseInt(data.get("period").toString()));

            // 3. Търсим Предмета по име в базата
            String subjectName = (String) data.get("subjectName");
            if (subjectName != null && !subjectName.isEmpty()) {
                subjectRepository.findBySubjectName(subjectName).ifPresent(record::setSubject);
            }

            // 4. Търсим Учителя по име
            String teacherName = (String) data.get("teacherName");
            if (teacherName != null && !teacherName.isEmpty()) {
                teacherRepository.findByName(teacherName).ifPresent(record::setTeacher);
            }

            recordsToSave.add(record);
        }
        timetableRecordRepository.saveAll(recordsToSave);
    }
}

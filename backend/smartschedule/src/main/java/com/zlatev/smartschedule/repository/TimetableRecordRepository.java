package com.zlatev.smartschedule.repository;

import com.zlatev.smartschedule.entity.TimetableRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimetableRecordRepository extends JpaRepository<TimetableRecord, Long> {
    List<TimetableRecord> findByClassCode(String classCode);
    void deleteByClassCode(String classCode); // Полезно при презаписване на програма
}
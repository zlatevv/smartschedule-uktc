package com.zlatev.smartschedule.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "timetable_records")
public class TimetableRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String classCode;
    private int dayOfWeek; // 0 = Понеделник, 4 = Петък
    private int period;    // 0 = 1ви час, 6 = 7ми час

    @ManyToOne
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @ManyToOne
    @JoinColumn(name = "teacher_id")
    private Teacher teacher;

    @ManyToOne
    @JoinColumn(name = "room_id")
    private Room room;

    public TimetableRecord(String classCode, int dayOfWeek, int period, Subject subject, Teacher teacher, Room room) {
        this.classCode = classCode;
        this.dayOfWeek = dayOfWeek;
        this.period = period;
        this.subject = subject;
        this.teacher = teacher;
        this.room = room;
    }
    public TimetableRecord() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(int dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public int getPeriod() {
        return period;
    }

    public void setPeriod(int period) {
        this.period = period;
    }

    public Subject getSubject() {
        return subject;
    }

    public void setSubject(Subject subject) {
        this.subject = subject;
    }

    public Teacher getTeacher() {
        return teacher;
    }

    public void setTeacher(Teacher teacher) {
        this.teacher = teacher;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }
}
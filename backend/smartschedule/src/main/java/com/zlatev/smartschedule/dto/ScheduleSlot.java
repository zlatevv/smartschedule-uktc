package com.zlatev.smartschedule.dto;

import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;

public class ScheduleSlot {
    private Subject subject;
    private Teacher teacher;
    private Room room;

    private Subject subject2;
    private Teacher teacher2;
    private Room room2;

    public ScheduleSlot(Subject subject, Teacher teacher, Room room) {
        this.subject = subject;
        this.teacher = teacher;
        this.room = room;
    }

    public ScheduleSlot(Subject subject, Teacher teacher, Room room,
                        Subject subject2, Teacher teacher2, Room room2) {
        this.subject = subject;
        this.teacher = teacher;
        this.room = room;
        this.subject2 = subject2;
        this.teacher2 = teacher2;
        this.room2 = room2;
    }

    public boolean isSplit() {
        return subject2 != null;
    }

    // --- Getters & Setters ---
    public Subject getSubject() { return subject; }
    public void setSubject(Subject subject) { this.subject = subject; }

    public Teacher getTeacher() { return teacher; }
    public void setTeacher(Teacher teacher) { this.teacher = teacher; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public Subject getSubject2() { return subject2; }
    public void setSubject2(Subject subject2) { this.subject2 = subject2; }

    public Teacher getTeacher2() { return teacher2; }
    public void setTeacher2(Teacher teacher2) { this.teacher2 = teacher2; }

    public Room getRoom2() { return room2; }
    public void setRoom2(Room room2) { this.room2 = room2; }
}
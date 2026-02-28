package com.zlatev.smartschedule.dto;

import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.entity.Subject;
import com.zlatev.smartschedule.entity.Teacher;

public class ScheduleSlot {
    public Subject subject;
    public Teacher teacher;
    public Room room;

    public ScheduleSlot(Subject subject, Teacher teacher, Room room) {
        this.subject = subject;
        this.teacher = teacher;
        this.room = room;
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

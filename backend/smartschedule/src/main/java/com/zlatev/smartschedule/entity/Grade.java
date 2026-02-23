package com.zlatev.smartschedule.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "grade")
public class Grade {
    @Id
    private String classCode;
    @OneToOne
    @JoinColumn(name = "lead_teacher_id")
    private Teacher classTeacher;

    public Grade(String classCode, Teacher classTeacher) {
        this.classCode = classCode;
        this.classTeacher = classTeacher;
    }

    public Grade() {}

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        if (classCode == null || classCode.isEmpty()) {
            throw new IllegalArgumentException("classCode cannot be null or empty");
        }
        this.classCode = classCode;
    }

    public Teacher getClassTeacher() {
        return classTeacher;
    }

    public void setClassTeacher(Teacher classTeacher) {
        if (classTeacher == null) {
            throw new IllegalArgumentException("classTeacher given is empty!");
        }
        this.classTeacher = classTeacher;
    }
}
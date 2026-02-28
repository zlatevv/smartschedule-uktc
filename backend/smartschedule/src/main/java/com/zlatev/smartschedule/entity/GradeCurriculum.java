package com.zlatev.smartschedule.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "classCurriculums")
public class GradeCurriculum {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    // The class code, e.g., "251", "241", "211"
    @Column(name = "grade_level", nullable = false)
    private int gradeLevel;

    // The subject they are studying
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(name = "hours_per_week", nullable = false)
    private int hoursPerWeek;

    public GradeCurriculum() {}

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getGradeLevel() {
        return gradeLevel;
    }

    public void setGradeLevel(int gradeLevel) {
        this.gradeLevel = gradeLevel;
    }

    public Subject getSubject() { return subject; }
    public void setSubject(Subject subject) { this.subject = subject; }

    public int getHoursPerWeek() { return hoursPerWeek; }
    public void setHoursPerWeek(int hoursPerWeek) { this.hoursPerWeek = hoursPerWeek; }
}

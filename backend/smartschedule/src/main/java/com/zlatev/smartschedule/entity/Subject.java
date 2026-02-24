package com.zlatev.smartschedule.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "subjects")
public class Subject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "subjectId")
    private int subjectId;
    @Column
    private String subjectName;
    @Column
    private String subjectDescription;
    @Column
    private String subjectType;

    public Subject(String subjectName, String subjectDescription, String subjectType) {
        this.subjectName = subjectName;
        this.subjectDescription = subjectDescription;
        this.subjectType = subjectType;
    }
    public Subject() {}

    public int getSubjectId() {
        return subjectId;
    }

    public String getSubjectDescription() {
        return subjectDescription;
    }

    public void setSubjectDescription(String subjectDescription) {
        this.subjectDescription = subjectDescription;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        if (subjectName == null || subjectName.isEmpty()) {
            throw new IllegalArgumentException("Subject name cannot be empty");
        }
        this.subjectName = subjectName;
    }

    public String getSubjectType() {
        return subjectType;
    }

    public void setSubjectType(String subjectType) {
        if (subjectType == null || subjectType.isEmpty()) {
            throw new IllegalArgumentException("Subject type cannot be empty");
        }
        this.subjectType = subjectType;
    }
}

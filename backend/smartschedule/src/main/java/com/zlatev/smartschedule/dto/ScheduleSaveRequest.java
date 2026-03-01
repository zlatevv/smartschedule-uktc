package com.zlatev.smartschedule.dto;

public class ScheduleSaveRequest {
    private String classCode;
    private int dayOfWeek;
    private int period;
    private String subjectName;
    private String teacherName;
    private String roomName;

    public ScheduleSaveRequest() {}

    // Getters and Setters
    public String getClassCode() { return classCode; }
    public void setClassCode(String classCode) { this.classCode = classCode; }

    public int getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(int dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public int getPeriod() { return period; }
    public void setPeriod(int period) { this.period = period; }

    public String getSubjectName() { return subjectName; }
    public void setSubjectName(String subjectName) { this.subjectName = subjectName; }

    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }
}
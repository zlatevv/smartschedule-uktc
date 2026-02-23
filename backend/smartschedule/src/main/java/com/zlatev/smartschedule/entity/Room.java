package com.zlatev.smartschedule.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "rooms")
public class Room {
    @Id
    private int roomId;
    @Column
    private boolean hasComputers;

    public Room(int roomId, boolean hasComputers) {
        this.roomId = roomId;
        this.hasComputers = hasComputers;
    }
    public Room() {}

    public int getRoomId() {
        return roomId;
    }

    public void setRoomId(int roomId) {
        if (roomId <= 0) {
            throw new IllegalArgumentException("Room ID must be greater than zero");
        }
        this.roomId = roomId;
    }

    public boolean isHasComputers() {
        return hasComputers;
    }

    public void setHasComputers(boolean hasComputers) {
        this.hasComputers = hasComputers;
    }
}

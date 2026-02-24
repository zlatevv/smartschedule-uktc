package com.zlatev.smartschedule.repository;

import com.zlatev.smartschedule.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<Room, Long> {
}

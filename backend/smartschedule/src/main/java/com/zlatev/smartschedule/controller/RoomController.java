package com.zlatev.smartschedule.controller;

import com.zlatev.smartschedule.entity.Room;
import com.zlatev.smartschedule.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {
    @Autowired
    private RoomRepository roomRepository;

    @GetMapping
    public List<Room> getAllRooms(){
        return roomRepository.findAll();
    }

    @PostMapping
    public Room addRoom(@RequestBody Room room){
        return roomRepository.save(room);
    }
}

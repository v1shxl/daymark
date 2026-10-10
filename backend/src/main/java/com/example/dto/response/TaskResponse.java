package com.example.dto.response;

import com.example.entity.Task;
import com.example.entity.TaskStatus;

import java.time.LocalDateTime;

public record TaskResponse(
        Long id,
        String title,
        String Description,
        TaskStatus status,
        LocalDateTime createdAt
) {
    public static TaskResponse from(Task t){
        return new TaskResponse(t.getId(), t.getTitle(), t.getDescription(), t.getStatus(), t.getCreatedAt());    }
}

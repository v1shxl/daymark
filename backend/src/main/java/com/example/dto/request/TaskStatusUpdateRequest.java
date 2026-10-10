package com.example.dto.request;

import com.example.entity.TaskStatus;
import jakarta.validation.constraints.NotBlank;

public record TaskStatusUpdateRequest (
        @NotBlank
        TaskStatus status
){
}

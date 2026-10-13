package com.example.service;

import com.example.dto.request.TaskTitleUpdateRequest;
import com.example.entity.Task;
import com.example.entity.TaskStatus;
import com.example.exception.TaskNotFoundException;
import com.example.repository.TaskRepository;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskTitleUpdateTests {
    @Test
    void updatesOnlyTitle() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Old title", "Keep description");
        task.setId(1L);
        task.setStatus(TaskStatus.DONE);
        var createdAt = task.getCreatedAt();
        when(repository.findById(1L)).thenReturn(Optional.of(task));

        var response = new TaskService(repository).updateTitle(1L, "New title");

        assertEquals("New title", response.title());
        assertEquals("New title", task.getTitle());
        assertEquals("Keep description", task.getDescription());
        assertEquals(TaskStatus.DONE, task.getStatus());
        assertEquals(createdAt, task.getCreatedAt());
        assertEquals(1L, task.getId());
    }

    @Test
    void missingTaskThrowsExistingException() {
        TaskRepository repository = mock(TaskRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(TaskNotFoundException.class,
                () -> new TaskService(repository).updateTitle(1L, "New title"));
    }

    @Test
    void validatesTitle() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (String title : new String[]{null, "", "   ", "x".repeat(101)}) {
                assertFalse(validator.validate(new TaskTitleUpdateRequest(title)).isEmpty());
            }
            assertTrue(validator.validate(new TaskTitleUpdateRequest("x".repeat(100))).isEmpty());
        }
    }
}

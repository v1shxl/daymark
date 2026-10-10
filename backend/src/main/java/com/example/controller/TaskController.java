package com.example.controller;

import com.example.dto.request.TaskRequest;
import com.example.dto.request.TaskStatusUpdateRequest;
import com.example.dto.response.TaskResponse;
import com.example.entity.TaskStatus;
import com.example.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService service;

    public TaskController(TaskService service){
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@Valid
    @RequestBody
    TaskRequest request){
        TaskResponse created = service.create(request);
        URI location = URI.create("/api/tasks/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping
    public Page<TaskResponse> list(
            @RequestParam(required = false)TaskStatus status,
            @PageableDefault(size = 10, sort = "createdAt")Pageable pageable){
        return service.list(status, pageable);
    }

    @GetMapping("/{id}")
    public TaskResponse get(
            @PathVariable(required = true) Long id) {
             return service.get(id);
    }

    @PutMapping("/{id}")
    public TaskResponse update(
            @PathVariable Long id,
            @RequestBody TaskRequest request){
        return service.update(id, request);
    }

    @PutMapping("status/{id}")
    public TaskResponse updateStatus(
            @PathVariable Long id,
            @RequestBody TaskStatusUpdateRequest updateRequest){
        return service.updateStatus(id, updateRequest.status());
    }


    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id){
        service.delete(id);
    }
}

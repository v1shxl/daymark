package com.example.service;

import com.example.dto.request.TaskRequest;
import com.example.dto.request.TaskStatusUpdateRequest;
import com.example.dto.response.TaskResponse;
import com.example.entity.Task;
import com.example.entity.TaskStatus;
import com.example.exception.TaskNotFoundException;
import com.example.repository.TaskRepository;
import jakarta.transaction.TransactionScoped;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {
    private final TaskRepository repository;

    public TaskService(TaskRepository repository){
        this.repository = repository;
    }

    //create entry
    @Transactional
    public TaskResponse create(TaskRequest request){
        return TaskResponse.from(repository.save(new Task(request.title(), request.description())));
    }

    //get entry
    @Transactional(readOnly = true)
    public Page<TaskResponse> list(TaskStatus status, Pageable pageable){
        Page<Task> page = (status == null)
                ? repository.findAll(pageable)
                : repository.findByStatus(status, pageable);
        return page.map(TaskResponse::from);
    }

    @Transactional(readOnly = true)
    public TaskResponse get(long id){
        return repository.findById(id)
                .map(TaskResponse::from)
                .orElseThrow(() -> new TaskNotFoundException(id));
    }

    @Transactional
    public TaskResponse update(long id, TaskRequest request){
        Task task = repository.findById(id).orElseThrow(() -> new TaskNotFoundException(id));
        task.setTitle(request.title());
        task.setDescription(request.description());
        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse updateStatus(long id, TaskStatus status){
        Task task  = repository.findById(id).orElseThrow(() -> new TaskNotFoundException(id));
        task.setStatus(status);
        return TaskResponse.from(task);
    }

    @Transactional
    public void delete(long id){
        if(!repository.existsById(id)) throw new TaskNotFoundException(id);
        repository.deleteById(id);
    }
}

package com.example.repository;

import com.example.entity.Task;
import com.example.entity.TaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByStatus(TaskStatus status);
    Page<Task> findByStatus(TaskStatus status, Pageable pageable);
    List<Task> findByTitleContainingIgnoreCase(String fragment);
    boolean existsByTitle(String title);
    long countByStatus(TaskStatus status);
}

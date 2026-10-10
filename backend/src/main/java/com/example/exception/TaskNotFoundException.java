package com.example.exception;

public class TaskNotFoundException extends RuntimeException{

    public TaskNotFoundException(long id){
        super("Task with ID "+ id+ "not found.");
    }
}

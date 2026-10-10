package com.example.taskmanager;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello(){
        return "Helloo";
    }

    @GetMapping("/hello/{name}")
    public String returnHello(@PathVariable String name){
        return "Hello " + name;
    }
}

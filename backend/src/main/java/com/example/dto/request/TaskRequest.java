package com.example.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TaskRequest (
        @NotBlank
        @Size(max = 100, message = "Max 100 chars allowed")
        String title,

        @Size(max = 500)
        String description
) {
}

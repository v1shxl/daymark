package com.example.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TaskDescriptionUpdateRequest(@NotNull @Size(max = 700) String description) {
}

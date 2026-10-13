package com.example.dto.request;

import jakarta.validation.constraints.NotNull;

public record TaskDescriptionUpdateRequest(@NotNull String description) {
}

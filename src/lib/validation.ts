import { ZodType } from "zod";
import { ApiError } from "./errors";

export function validateOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }
  return parsed.data;
}

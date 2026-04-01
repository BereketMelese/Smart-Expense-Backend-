import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  DEFAULT_START_BALANCE: z.coerce.number().default(5000),
  TEST_DATABASE_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);

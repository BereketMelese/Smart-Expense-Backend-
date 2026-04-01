import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-key";
process.env.ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
process.env.REFRESH_TOKEN_TTL_DAYS = process.env.REFRESH_TOKEN_TTL_DAYS || "30";
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || "10";
process.env.DEFAULT_START_BALANCE = process.env.DEFAULT_START_BALANCE || "5000";

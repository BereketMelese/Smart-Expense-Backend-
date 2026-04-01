import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { env } from "../config/env";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSecureToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

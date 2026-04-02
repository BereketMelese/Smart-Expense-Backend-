import { hashToken, generateSecureToken } from "../lib/hash";

export type AccessTokenSigner = (payload: {
  sub: string;
  email: string;
}) => string;

export class AuthService {
  constructor(private readonly signAccessToken: AccessTokenSigner) {}

  issueAccessToken(userId: string, email: string): string {
    return this.signAccessToken({ sub: userId, email });
  }

  issueRefreshToken(ttlDays: number): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    return { token, tokenHash, expiresAt };
  }

  issuePasswordResetToken(ttlHours: number): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    return { token, tokenHash, expiresAt };
  }
}

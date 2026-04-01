import { describe, expect, it } from "vitest";
import { AuthService } from "../../src/services/auth.service";

describe("AuthService", () => {
  it("issues access token using signer", () => {
    const service = new AuthService(({ sub, email }) => `signed:${sub}:${email}`);
    const token = service.issueAccessToken("u1", "demo@example.com");

    expect(token).toBe("signed:u1:demo@example.com");
  });

  it("issues hashed refresh token with expiry", () => {
    const service = new AuthService(() => "access");
    const result = service.issueRefreshToken(30);

    expect(result.token).toBeTypeOf("string");
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.tokenHash).toBeTypeOf("string");
    expect(result.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

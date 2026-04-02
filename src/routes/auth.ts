import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { ApiError } from "../lib/errors";
import { hashPassword, hashToken, verifyPassword } from "../lib/hash";
import { validateOrThrow } from "../lib/validation";
import { AuthService } from "../services/auth.service";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  avatarUrl: z.url().optional(),
});

const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

const forgotPasswordSchema = z.object({
  email: z.email().toLowerCase(),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(10),
  password: z.string().min(8),
});

function mapUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService((payload) =>
    fastify.jwt.sign(payload, { expiresIn: env.ACCESS_TOKEN_TTL }),
  );

  fastify.post(
    "/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = validateOrThrow(registerSchema, request.body);

      const existing = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (existing) {
        throw new ApiError(409, "CONFLICT", "Email already registered");
      }

      const passwordHash = await hashPassword(body.password);
      const user = await fastify.prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash,
          avatarUrl: body.avatarUrl,
        },
      });

      const accessToken = authService.issueAccessToken(user.id, user.email);
      const refresh = authService.issueRefreshToken(env.REFRESH_TOKEN_TTL_DAYS);

      await fastify.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        },
      });

      reply.status(201).send({
        message: "Registered successfully",
        data: {
          user: mapUser(user),
          accessToken,
          refreshToken: refresh.token,
          expiresIn: env.ACCESS_TOKEN_TTL,
        },
      });
    },
  );

  fastify.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const body = validateOrThrow(loginSchema, request.body);

      const user = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
      }

      const accessToken = authService.issueAccessToken(user.id, user.email);
      const refresh = authService.issueRefreshToken(env.REFRESH_TOKEN_TTL_DAYS);

      await fastify.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        },
      });

      return {
        message: "Login successful",
        data: {
          user: mapUser(user),
          accessToken,
          refreshToken: refresh.token,
          expiresIn: env.ACCESS_TOKEN_TTL,
        },
      };
    },
  );

  fastify.post(
    "/refresh",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const body = validateOrThrow(refreshSchema, request.body);
      const tokenHash = hashToken(body.refreshToken);

      const refreshToken = await fastify.prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!refreshToken) {
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "Invalid or expired refresh token",
        );
      }

      const nextRefresh = authService.issueRefreshToken(
        env.REFRESH_TOKEN_TTL_DAYS,
      );
      const accessToken = authService.issueAccessToken(
        refreshToken.user.id,
        refreshToken.user.email,
      );

      await fastify.prisma.$transaction([
        fastify.prisma.refreshToken.update({
          where: { id: refreshToken.id },
          data: { revokedAt: new Date() },
        }),
        fastify.prisma.refreshToken.create({
          data: {
            userId: refreshToken.user.id,
            tokenHash: nextRefresh.tokenHash,
            expiresAt: nextRefresh.expiresAt,
          },
        }),
      ]);

      return {
        message: "Token refreshed",
        data: {
          accessToken,
          refreshToken: nextRefresh.token,
          expiresIn: env.ACCESS_TOKEN_TTL,
        },
      };
    },
  );

  fastify.post(
    "/logout",
    { preHandler: fastify.authenticate },
    async (request) => {
      const body = validateOrThrow(logoutSchema, request.body);
      await fastify.prisma.refreshToken.updateMany({
        where: {
          tokenHash: hashToken(body.refreshToken),
          userId: request.user.sub,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return {
        message: "Logged out",
      };
    },
  );

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    return {
      message: "Current user fetched",
      data: user,
    };
  });

  fastify.post(
    "/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request) => {
      const body = validateOrThrow(forgotPasswordSchema, request.body);
      const user = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });

      const reset = user ? authService.issuePasswordResetToken(1) : null;

      if (user && reset) {
        await fastify.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: reset.tokenHash,
            expiresAt: reset.expiresAt,
          },
        });
      }

      return {
        message: "If an account exists, a reset link has been sent",
        data: {
          email: body.email,
          delivery: "mock",
          accepted: true,
          resetToken: reset?.token ?? null,
        },
      };
    },
  );

  fastify.post(
    "/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const body = validateOrThrow(resetPasswordSchema, request.body);
      const tokenHash = hashToken(body.resetToken);

      const resetToken = await fastify.prisma.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!resetToken) {
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "Invalid or expired reset token",
        );
      }

      const passwordHash = await hashPassword(body.password);

      await fastify.prisma.$transaction([
        fastify.prisma.user.update({
          where: { id: resetToken.user.id },
          data: { passwordHash },
        }),
        fastify.prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        fastify.prisma.refreshToken.updateMany({
          where: { userId: resetToken.user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);

      return {
        message: "Password reset successful",
        data: {
          email: resetToken.user.email,
        },
      };
    },
  );
};

export default authRoutes;

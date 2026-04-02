import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { FastifyInstance } from "fastify";
import { env } from "./config/env";
import { ApiError } from "./lib/errors";
import { prisma } from "./lib/prisma";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import expensesRoutes from "./routes/expenses";
import habitsRoutes from "./routes/habits";
import incomesRoutes from "./routes/incomes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.decorate("prisma", prisma);

  app.register(cors, {
    origin: [env.APP_ORIGIN],
    credentials: true,
  });

  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      message: "Too many requests",
      code: "RATE_LIMITED",
      details: { max: context.max, timeWindow: context.after },
    }),
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: "Smart Expense API",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:4000" }],
      tags: [
        { name: "auth" },
        { name: "expenses" },
        { name: "incomes" },
        { name: "habits" },
        { name: "dashboard" },
      ],
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(
    async (api) => {
      api.register(authRoutes, { prefix: "/auth" });
      api.register(expensesRoutes, { prefix: "/expenses" });
      api.register(incomesRoutes, { prefix: "/incomes" });
      api.register(habitsRoutes, { prefix: "/habits" });
      api.register(dashboardRoutes, { prefix: "/dashboard" });
    },
    { prefix: "/api" },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      });
    }

    if ((error as { code?: string }).code === "P2002") {
      return reply.status(409).send({
        message: "Resource already exists",
        code: "CONFLICT",
      });
    }

    if ((error as { code?: string })?.code?.startsWith("P")) {
      return reply.status(400).send({
        message: "Database request failed",
        code: "VALIDATION_ERROR",
      });
    }

    if ((error as { statusCode?: number }).statusCode === 401) {
      return reply.status(401).send({
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });

  app.addHook("onClose", async () => {
    await app.prisma.$disconnect();
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

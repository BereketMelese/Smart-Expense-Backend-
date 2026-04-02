import { HabitTargetType } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import { validateOrThrow } from "../lib/validation";

const habitBodySchema = z.object({
  name: z.string().min(1),
  targetType: z.enum([
    HabitTargetType.DAILY,
    HabitTargetType.WEEKLY,
    HabitTargetType.MONTHLY,
  ]),
  targetCount: z.coerce.number().int().positive(),
  scheduledWeekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  color: z.string().optional(),
});

const habitUpdateSchema = habitBodySchema.partial();

const idParamSchema = z.object({
  id: z.string().min(1),
});

const checkInBodySchema = z.object({
  checkInDate: z.iso.datetime().optional(),
  value: z.coerce.number().int().positive().default(1),
});

const checkInQuerySchema = z.object({
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});

const habitsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: fastify.authenticate }, async (request) => {
    const habits = await fastify.prisma.habit.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
    });

    return {
      message: "Habits fetched",
      data: habits,
    };
  });

  fastify.post(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = validateOrThrow(habitBodySchema, request.body);

      const habit = await fastify.prisma.habit.create({
        data: {
          userId: request.user.sub,
          name: body.name,
          targetType: body.targetType,
          targetCount: body.targetCount,
          scheduledWeekdays: body.scheduledWeekdays,
          color: body.color,
        },
      });

      reply.status(201).send({
        message: "Habit created",
        data: habit,
      });
    },
  );

  fastify.put("/:id", { preHandler: fastify.authenticate }, async (request) => {
    const params = validateOrThrow(idParamSchema, request.params);
    const body = validateOrThrow(habitUpdateSchema, request.body);

    const existing = await fastify.prisma.habit.findFirst({
      where: { id: params.id, userId: request.user.sub },
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Habit not found");
    }

    const habit = await fastify.prisma.habit.update({
      where: { id: params.id },
      data: body,
    });

    return {
      message: "Habit updated",
      data: habit,
    };
  });

  fastify.delete(
    "/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      const params = validateOrThrow(idParamSchema, request.params);

      const existing = await fastify.prisma.habit.findFirst({
        where: { id: params.id, userId: request.user.sub },
      });

      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Habit not found");
      }

      await fastify.prisma.habit.delete({ where: { id: params.id } });

      return {
        message: "Habit deleted",
      };
    },
  );

  fastify.post(
    "/:id/check-ins",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const params = validateOrThrow(idParamSchema, request.params);
      const body = validateOrThrow(checkInBodySchema, request.body);

      const habit = await fastify.prisma.habit.findFirst({
        where: { id: params.id, userId: request.user.sub },
      });

      if (!habit) {
        throw new ApiError(404, "NOT_FOUND", "Habit not found");
      }

      const date = body.checkInDate ? new Date(body.checkInDate) : new Date();

      const checkIn = await fastify.prisma.habitCheckIn.upsert({
        where: {
          habitId_checkInDate: {
            habitId: habit.id,
            checkInDate: date,
          },
        },
        create: {
          habitId: habit.id,
          userId: request.user.sub,
          checkInDate: date,
          value: body.value,
        },
        update: {
          value: body.value,
        },
      });

      reply.status(201).send({
        message: "Habit check-in saved",
        data: checkIn,
      });
    },
  );

  fastify.get(
    "/:id/check-ins",
    { preHandler: fastify.authenticate },
    async (request) => {
      const params = validateOrThrow(idParamSchema, request.params);
      const query = validateOrThrow(checkInQuerySchema, request.query);

      const habit = await fastify.prisma.habit.findFirst({
        where: { id: params.id, userId: request.user.sub },
      });

      if (!habit) {
        throw new ApiError(404, "NOT_FOUND", "Habit not found");
      }

      const checkIns = await fastify.prisma.habitCheckIn.findMany({
        where: {
          habitId: habit.id,
          userId: request.user.sub,
          ...(query.startDate || query.endDate
            ? {
                checkInDate: {
                  ...(query.startDate
                    ? { gte: new Date(query.startDate) }
                    : {}),
                  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        },
        orderBy: { checkInDate: "desc" },
      });

      return {
        message: "Habit check-ins fetched",
        data: checkIns,
      };
    },
  );
};

export default habitsRoutes;

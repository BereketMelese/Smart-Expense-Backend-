import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import { validateOrThrow } from "../lib/validation";

const incomeBodySchema = z.object({
  title: z.string().min(1),
  amount: z.coerce.number().positive(),
  category: z.string().min(1),
  incomeDate: z.iso.datetime(),
  notes: z.string().optional(),
});

const incomeUpdateSchema = incomeBodySchema.partial();

const incomeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const incomesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: fastify.authenticate }, async (request) => {
    const query = validateOrThrow(incomeQuerySchema, request.query);

    const where = {
      userId: request.user.sub,
      ...(query.category ? { category: query.category } : {}),
      ...(query.startDate || query.endDate
        ? {
            incomeDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      fastify.prisma.income.findMany({
        where,
        orderBy: { incomeDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.income.count({ where }),
    ]);

    return {
      message: "Incomes fetched",
      data: {
        items: items.map((item) => ({
          ...item,
          amount: Number(item.amount),
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      },
    };
  });

  fastify.post(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = validateOrThrow(incomeBodySchema, request.body);

      const created = await fastify.prisma.income.create({
        data: {
          userId: request.user.sub,
          title: body.title,
          amount: body.amount,
          category: body.category,
          incomeDate: new Date(body.incomeDate),
          notes: body.notes,
        },
      });

      reply.status(201).send({
        message: "Income created",
        data: {
          ...created,
          amount: Number(created.amount),
        },
      });
    },
  );

  fastify.put("/:id", { preHandler: fastify.authenticate }, async (request) => {
    const params = validateOrThrow(idParamSchema, request.params);
    const body = validateOrThrow(incomeUpdateSchema, request.body);

    const existing = await fastify.prisma.income.findFirst({
      where: { id: params.id, userId: request.user.sub },
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Income not found");
    }

    const updated = await fastify.prisma.income.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.incomeDate !== undefined
          ? { incomeDate: new Date(body.incomeDate) }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    return {
      message: "Income updated",
      data: {
        ...updated,
        amount: Number(updated.amount),
      },
    };
  });

  fastify.delete(
    "/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      const params = validateOrThrow(idParamSchema, request.params);

      const existing = await fastify.prisma.income.findFirst({
        where: { id: params.id, userId: request.user.sub },
      });

      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Income not found");
      }

      await fastify.prisma.income.delete({ where: { id: params.id } });

      return {
        message: "Income deleted",
      };
    },
  );
};

export default incomesRoutes;

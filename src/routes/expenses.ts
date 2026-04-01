import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import { validateOrThrow } from "../lib/validation";

const expenseBodySchema = z.object({
  title: z.string().min(1),
  amount: z.coerce.number().positive(),
  category: z.string().min(1),
  expenseDate: z.iso.datetime(),
  notes: z.string().optional()
});

const expenseUpdateSchema = expenseBodySchema.partial();

const expenseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional()
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

const expensesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: fastify.authenticate }, async (request) => {
    const query = validateOrThrow(expenseQuerySchema, request.query);

    const where = {
      userId: request.user.sub,
      ...(query.category ? { category: query.category } : {}),
      ...(query.startDate || query.endDate
        ? {
            expenseDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {})
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      fastify.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      fastify.prisma.expense.count({ where })
    ]);

    return {
      message: "Expenses fetched",
      data: {
        items: items.map((item: any) => ({
          ...item,
          amount: Number(item.amount)
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize)
        }
      }
    };
  });

  fastify.post("/", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = validateOrThrow(expenseBodySchema, request.body);

    const created = await fastify.prisma.expense.create({
      data: {
        userId: request.user.sub,
        title: body.title,
        amount: body.amount,
        category: body.category,
        expenseDate: new Date(body.expenseDate),
        notes: body.notes
      }
    });

    reply.status(201).send({
      message: "Expense created",
      data: {
        ...created,
        amount: Number(created.amount)
      }
    });
  });

  fastify.put("/:id", { preHandler: fastify.authenticate }, async (request) => {
    const params = validateOrThrow(idParamSchema, request.params);
    const body = validateOrThrow(expenseUpdateSchema, request.body);

    const existing = await fastify.prisma.expense.findFirst({
      where: { id: params.id, userId: request.user.sub }
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Expense not found");
    }

    const updated = await fastify.prisma.expense.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.expenseDate !== undefined ? { expenseDate: new Date(body.expenseDate) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      }
    });

    return {
      message: "Expense updated",
      data: {
        ...updated,
        amount: Number(updated.amount)
      }
    };
  });

  fastify.delete("/:id", { preHandler: fastify.authenticate }, async (request) => {
    const params = validateOrThrow(idParamSchema, request.params);

    const existing = await fastify.prisma.expense.findFirst({
      where: { id: params.id, userId: request.user.sub }
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Expense not found");
    }

    await fastify.prisma.expense.delete({ where: { id: params.id } });

    return {
      message: "Expense deleted"
    };
  });
};

export default expensesRoutes;

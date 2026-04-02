import { HabitTargetType } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { env } from "../config/env";

function getMonthRange(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

function getPeriodRange(
  targetType: HabitTargetType,
  now = new Date(),
): { start: Date; end: Date } {
  if (targetType === HabitTargetType.DAILY) {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ),
    };
  }

  if (targetType === HabitTargetType.WEEKLY) {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getCurrentStreak(dates: Date[]): number {
  const dateSet = new Set(
    dates.map((d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
    ),
  );

  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  while (dateSet.has(current.getTime())) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/summary",
    { preHandler: fastify.authenticate },
    async (request) => {
      const { start, end } = getMonthRange();

      const [
        monthlyExpenseAggregate,
        totalExpenseAggregate,
        monthlyIncomeAggregate,
        totalIncomeAggregate,
        checkIns,
        user,
      ] = await Promise.all([
        fastify.prisma.expense.aggregate({
          where: {
            userId: request.user.sub,
            expenseDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        fastify.prisma.expense.aggregate({
          where: { userId: request.user.sub },
          _sum: { amount: true },
        }),
        fastify.prisma.income.aggregate({
          where: {
            userId: request.user.sub,
            incomeDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        fastify.prisma.income.aggregate({
          where: { userId: request.user.sub },
          _sum: { amount: true },
        }),
        fastify.prisma.habitCheckIn.findMany({
          where: { userId: request.user.sub },
          select: { checkInDate: true },
          orderBy: { checkInDate: "desc" },
        }),
        fastify.prisma.user.findUnique({
          where: { id: request.user.sub },
          select: { startingBalance: true },
        }),
      ]);

      const monthlySpend = Number(monthlyExpenseAggregate._sum.amount ?? 0);
      const totalSpend = Number(totalExpenseAggregate._sum.amount ?? 0);
      const monthlyIncome = Number(monthlyIncomeAggregate._sum.amount ?? 0);
      const totalIncome = Number(totalIncomeAggregate._sum.amount ?? 0);
      const startingBalance = Number(
        user?.startingBalance ?? env.DEFAULT_START_BALANCE,
      );
      const currentBalance = startingBalance + totalIncome - totalSpend;

      return {
        message: "Dashboard summary fetched",
        data: {
          currentBalance,
          monthlyIncome,
          monthlySpend,
          currentStreak: getCurrentStreak(
            checkIns.map((c: any) => c.checkInDate),
          ),
        },
      };
    },
  );

  fastify.get(
    "/recent-transactions",
    { preHandler: fastify.authenticate },
    async (request) => {
      const transactions = await fastify.prisma.expense.findMany({
        where: { userId: request.user.sub },
        orderBy: { expenseDate: "desc" },
        take: 10,
      });

      return {
        message: "Recent transactions fetched",
        data: transactions.map((item: any) => ({
          ...item,
          amount: Number(item.amount),
        })),
      };
    },
  );

  fastify.get(
    "/habit-progress",
    { preHandler: fastify.authenticate },
    async (request) => {
      const habits = await fastify.prisma.habit.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: "desc" },
      });

      const progress = await Promise.all(
        habits.map(async (habit: any) => {
          const range = getPeriodRange(habit.targetType);
          const aggregate = await fastify.prisma.habitCheckIn.aggregate({
            where: {
              userId: request.user.sub,
              habitId: habit.id,
              checkInDate: {
                gte: range.start,
                lte: range.end,
              },
            },
            _sum: { value: true },
          });

          const current = aggregate._sum.value ?? 0;
          const percent = Math.min(
            100,
            Math.round((current / habit.targetCount) * 100),
          );

          return {
            habitId: habit.id,
            habitName: habit.name,
            targetType: habit.targetType,
            targetCount: habit.targetCount,
            currentCount: current,
            progressPercent: Number.isFinite(percent) ? percent : 0,
            color: habit.color,
          };
        }),
      );

      return {
        message: "Habit progress fetched",
        data: progress,
      };
    },
  );
};

export default dashboardRoutes;

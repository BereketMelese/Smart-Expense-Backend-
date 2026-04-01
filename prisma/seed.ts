import "dotenv/config";
import { HabitTargetType, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = [
    {
      name: "Demo User",
      email: "demo@example.com",
      password: "demo12345",
      avatarUrl: "https://i.pravatar.cc/120?img=12"
    },
    {
      name: "Demo User Two",
      email: "demo2@example.com",
      password: "demo12345",
      avatarUrl: "https://i.pravatar.cc/120?img=32"
    }
  ];

  for (const item of users) {
    const passwordHash = await hashPassword(item.password);

    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        name: item.name,
        avatarUrl: item.avatarUrl,
        passwordHash
      },
      create: {
        name: item.name,
        email: item.email,
        avatarUrl: item.avatarUrl,
        passwordHash
      }
    });

    await prisma.expense.createMany({
      data: [
        {
          userId: user.id,
          title: "Groceries",
          amount: 82.75,
          category: "Food",
          expenseDate: new Date(),
          notes: "Weekly market"
        },
        {
          userId: user.id,
          title: "Internet bill",
          amount: 45.0,
          category: "Utilities",
          expenseDate: new Date(),
          notes: "Monthly internet"
        }
      ]
    });

    const habit = await prisma.habit.upsert({
      where: {
        id: `${user.id}-habit-fitness`
      },
      update: {
        name: "Workout",
        targetType: HabitTargetType.DAILY,
        targetCount: 1,
        color: "#0ea5e9"
      },
      create: {
        id: `${user.id}-habit-fitness`,
        userId: user.id,
        name: "Workout",
        targetType: HabitTargetType.DAILY,
        targetCount: 1,
        color: "#0ea5e9"
      }
    });

    await prisma.habitCheckIn.createMany({
      data: [
        {
          habitId: habit.id,
          userId: user.id,
          checkInDate: new Date(),
          value: 1
        },
        {
          habitId: habit.id,
          userId: user.id,
          checkInDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          value: 1
        }
      ],
      skipDuplicates: true
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

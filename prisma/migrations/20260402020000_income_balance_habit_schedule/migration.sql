-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN     "startingBalance" DECIMAL(12,2) NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE "public"."Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "incomeDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."Habit"
ADD COLUMN     "scheduledWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateIndex
CREATE INDEX "Income_userId_incomeDate_idx" ON "public"."Income"("userId", "incomeDate");

-- CreateIndex
CREATE INDEX "Income_userId_category_idx" ON "public"."Income"("userId", "category");

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

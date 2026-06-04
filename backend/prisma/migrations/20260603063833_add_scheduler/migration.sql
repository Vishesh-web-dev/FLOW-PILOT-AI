-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'SCHEDULE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'SCHEDULE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'SCHEDULE_CHECKED';

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ScheduleType" NOT NULL DEFAULT 'DAILY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeOfDay" TEXT,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduleId" TEXT NOT NULL,

    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_logs" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,

    CONSTRAINT "schedule_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_logs_scheduleItemId_date_key" ON "schedule_logs"("scheduleItemId", "date");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_logs" ADD CONSTRAINT "schedule_logs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_logs" ADD CONSTRAINT "schedule_logs_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "schedule_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

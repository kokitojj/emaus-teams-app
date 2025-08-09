/*
  Warnings:

  - You are about to drop the column `shiftId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `Shift` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ShiftToWorker` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `taskTypeId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ShiftToWorker" DROP CONSTRAINT "_ShiftToWorker_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ShiftToWorker" DROP CONSTRAINT "_ShiftToWorker_B_fkey";

-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "shiftId",
ADD COLUMN     "taskTypeId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Shift";

-- DropTable
DROP TABLE "public"."_ShiftToWorker";

-- CreateTable
CREATE TABLE "public"."TaskType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_TaskTypeToWorker" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskTypeToWorker_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskType_name_key" ON "public"."TaskType"("name");

-- CreateIndex
CREATE INDEX "_TaskTypeToWorker_B_index" ON "public"."_TaskTypeToWorker"("B");

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "public"."TaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TaskTypeToWorker" ADD CONSTRAINT "_TaskTypeToWorker_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."TaskType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TaskTypeToWorker" ADD CONSTRAINT "_TaskTypeToWorker_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

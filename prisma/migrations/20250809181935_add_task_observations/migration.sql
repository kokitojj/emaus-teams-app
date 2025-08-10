/*
  Warnings:

  - You are about to drop the column `assignedWorkerId` on the `Task` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_assignedWorkerId_fkey";

-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "assignedWorkerId",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."_TaskToWorker" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskToWorker_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskToWorker_B_index" ON "public"."_TaskToWorker"("B");

-- AddForeignKey
ALTER TABLE "public"."_TaskToWorker" ADD CONSTRAINT "_TaskToWorker_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TaskToWorker" ADD CONSTRAINT "_TaskToWorker_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

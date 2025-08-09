/*
  Warnings:

  - You are about to drop the column `name` on the `Worker` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `Worker` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `Worker` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Worker" DROP COLUMN "name",
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_username_key" ON "public"."Worker"("username");

-- AlterTable
ALTER TABLE "public"."LeaveRequest" ADD COLUMN     "managerNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "public"."TaskType" ADD COLUMN     "color" TEXT;

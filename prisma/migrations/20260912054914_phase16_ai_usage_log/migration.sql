-- DropIndex
DROP INDEX "Company_name_trgm_idx";

-- DropIndex
DROP INDEX "JobRole_title_trgm_idx";

-- DropIndex
DROP INDEX "PlacementDrive_title_trgm_idx";

-- DropIndex
DROP INDEX "Student_enrollmentNumber_trgm_idx";

-- DropIndex
DROP INDEX "Student_firstName_trgm_idx";

-- DropIndex
DROP INDEX "Student_lastName_trgm_idx";

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

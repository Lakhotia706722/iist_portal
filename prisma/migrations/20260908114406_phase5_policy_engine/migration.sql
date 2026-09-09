-- CreateEnum
CREATE TYPE "PolicyValueType" AS ENUM ('NUMBER', 'BOOLEAN', 'STRING');

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "PolicyValueType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "batchId" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRule_key_idx" ON "PolicyRule"("key");

-- CreateIndex
CREATE INDEX "PolicyRule_batchId_idx" ON "PolicyRule"("batchId");

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

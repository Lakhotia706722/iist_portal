-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('DRIVE_VISIT', 'PRE_PLACEMENT_TALK', 'APTITUDE_TEST', 'CODING_TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'SKILLUP_TEST', 'MOCK_INTERVIEW', 'DOCUMENT_DEADLINE', 'APPLICATION_DEADLINE', 'OTHER');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "venue" TEXT,
    "meetingLink" TEXT,
    "driveId" TEXT,
    "roundId" TEXT,
    "departmentId" TEXT,
    "batchId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrePlacementTalk" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER,
    "venue" TEXT,
    "meetingLink" TEXT,
    "instructions" TEXT,
    "faq" TEXT,
    "attachmentKeys" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrePlacementTalk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_idx" ON "CalendarEvent"("type");

-- CreateIndex
CREATE INDEX "CalendarEvent_driveId_idx" ON "CalendarEvent"("driveId");

-- CreateIndex
CREATE INDEX "CalendarEvent_batchId_idx" ON "CalendarEvent"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "PrePlacementTalk_driveId_key" ON "PrePlacementTalk"("driveId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrePlacementTalk" ADD CONSTRAINT "PrePlacementTalk_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

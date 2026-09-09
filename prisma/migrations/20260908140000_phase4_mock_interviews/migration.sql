-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'HR', 'MANAGERIAL', 'CASE_STUDY', 'GROUP_DISCUSSION', 'STRESS', 'MIXED');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "MockInterview" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "interviewerName" TEXT NOT NULL,
    "interviewerId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER,
    "targetRole" TEXT,
    "type" "InterviewType" NOT NULL DEFAULT 'MIXED',
    "mode" "InterviewMode" NOT NULL DEFAULT 'OFFLINE',
    "venue" TEXT,
    "meetingLink" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewResult" (
    "id" TEXT NOT NULL,
    "mockInterviewId" TEXT NOT NULL,
    "technicalScore" DOUBLE PRECISION,
    "communicationScore" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "problemSolvingScore" DOUBLE PRECISION,
    "hrScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "improvementSuggestions" TEXT[],
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockInterview_studentId_idx" ON "MockInterview"("studentId");

-- CreateIndex
CREATE INDEX "MockInterview_scheduledAt_idx" ON "MockInterview"("scheduledAt");

-- CreateIndex
CREATE INDEX "MockInterview_status_idx" ON "MockInterview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewResult_mockInterviewId_key" ON "InterviewResult"("mockInterviewId");

-- AddForeignKey
ALTER TABLE "MockInterview" ADD CONSTRAINT "MockInterview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewResult" ADD CONSTRAINT "InterviewResult_mockInterviewId_fkey" FOREIGN KEY ("mockInterviewId") REFERENCES "MockInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

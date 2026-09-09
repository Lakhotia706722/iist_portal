-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('TECHNOLOGY', 'FINANCE', 'CONSULTING', 'CORE_ENGINEERING', 'RESEARCH', 'DEFENSE', 'SPACE', 'HEALTHCARE', 'EDUCATION', 'MANUFACTURING', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "DriveStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPLICATIONS_OPEN', 'APPLICATIONS_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'WRITTEN_TEST', 'TECHNICAL_ROUND', 'HR_ROUND', 'FINAL_ROUND', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('WRITTEN_TEST', 'APTITUDE_TEST', 'CODING_TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'GROUP_DISCUSSION', 'PRESENTATION', 'MEDICAL', 'DOCUMENT_VERIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "RoundMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "EligibilityOperator" AS ENUM ('GTE', 'LTE', 'EQ', 'IN', 'NOT_IN');

-- CreateEnum
CREATE TYPE "EligibilityField" AS ENUM ('CGPA', 'ACTIVE_BACKLOGS', 'TOTAL_BACKLOGS', 'BATCH', 'BRANCH', 'COURSE', 'GENDER', 'CATEGORY', 'PLACEMENT_STATUS', 'PROFILE_STATUS', 'TENTH_PERCENTAGE', 'TWELFTH_PERCENTAGE', 'CURRENT_SEMESTER');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'JOINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('FULL_TIME', 'INTERNSHIP', 'INTERNSHIP_WITH_PPO', 'PPO', 'CONTRACT');

-- CreateEnum
CREATE TYPE "OfferCategory" AS ENUM ('CORE', 'NON_CORE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" "IndustryType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "website" TEXT,
    "logoKey" TEXT,
    "location" TEXT,
    "headcount" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementDrive" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" "DriveStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "applicationOpenAt" TIMESTAMP(3),
    "applicationCloseAt" TIMESTAMP(3),
    "driveStartDate" TIMESTAMP(3),
    "driveEndDate" TIMESTAMP(3),
    "workMode" "WorkMode" NOT NULL DEFAULT 'ONSITE',
    "locations" TEXT[],
    "bond" TEXT,
    "selectionProcess" TEXT,
    "perksAndBenefits" TEXT,
    "pointOfContact" TEXT,
    "pocEmail" TEXT,
    "pocPhone" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "ctcMin" DOUBLE PRECISION,
    "ctcMax" DOUBLE PRECISION,
    "ctcBreakdown" TEXT,
    "openings" INTEGER,
    "skills" TEXT[],
    "workMode" "WorkMode" NOT NULL DEFAULT 'ONSITE',
    "locations" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "field" "EligibilityField" NOT NULL,
    "operator" "EligibilityOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumeVersionId" TEXT,
    "resumeSnapshot" JSONB,
    "eligibilitySnapshot" JSONB,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" TEXT,
    "adminNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementRound" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "RoundType" NOT NULL DEFAULT 'OTHER',
    "mode" "RoundMode" NOT NULL DEFAULT 'OFFLINE',
    "scheduledAt" TIMESTAMP(3),
    "durationMins" INTEGER,
    "venue" TEXT,
    "meetingLink" TEXT,
    "instructions" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundParticipant" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "result" TEXT,
    "remarks" TEXT,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "roundParticipantId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,
    "note" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "OfferCategory" NOT NULL DEFAULT 'NON_CORE',
    "type" "OfferType" NOT NULL DEFAULT 'FULL_TIME',
    "isPPO" BOOLEAN NOT NULL DEFAULT false,
    "ctc" DOUBLE PRECISION,
    "stipend" DOUBLE PRECISION,
    "ctcBreakdown" TEXT,
    "location" TEXT,
    "offerDate" TIMESTAMP(3) NOT NULL,
    "joiningDate" TIMESTAMP(3),
    "offerLetterKey" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
    "statusNote" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_industry_idx" ON "Company"("industry");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "PlacementDrive_companyId_idx" ON "PlacementDrive"("companyId");

-- CreateIndex
CREATE INDEX "PlacementDrive_status_idx" ON "PlacementDrive"("status");

-- CreateIndex
CREATE INDEX "PlacementDrive_applicationCloseAt_idx" ON "PlacementDrive"("applicationCloseAt");

-- CreateIndex
CREATE INDEX "PlacementDrive_academicYear_idx" ON "PlacementDrive"("academicYear");

-- CreateIndex
CREATE INDEX "JobRole_driveId_idx" ON "JobRole"("driveId");

-- CreateIndex
CREATE INDEX "EligibilityRule_jobRoleId_idx" ON "EligibilityRule"("jobRoleId");

-- CreateIndex
CREATE INDEX "Application_studentId_idx" ON "Application"("studentId");

-- CreateIndex
CREATE INDEX "Application_driveId_idx" ON "Application"("driveId");

-- CreateIndex
CREATE INDEX "Application_jobRoleId_idx" ON "Application"("jobRoleId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentId_jobRoleId_key" ON "Application"("studentId", "jobRoleId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_idx" ON "ApplicationStatusHistory"("applicationId");

-- CreateIndex
CREATE INDEX "PlacementRound_driveId_idx" ON "PlacementRound"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementRound_driveId_roundNumber_key" ON "PlacementRound"("driveId", "roundNumber");

-- CreateIndex
CREATE INDEX "RoundParticipant_roundId_idx" ON "RoundParticipant"("roundId");

-- CreateIndex
CREATE INDEX "RoundParticipant_applicationId_idx" ON "RoundParticipant"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundParticipant_roundId_applicationId_key" ON "RoundParticipant"("roundId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_roundParticipantId_key" ON "AttendanceRecord"("roundParticipantId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_applicationId_key" ON "Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_studentId_idx" ON "Offer"("studentId");

-- CreateIndex
CREATE INDEX "Offer_companyId_idx" ON "Offer"("companyId");

-- CreateIndex
CREATE INDEX "Offer_driveId_idx" ON "Offer"("driveId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_offerDate_idx" ON "Offer"("offerDate");

-- AddForeignKey
ALTER TABLE "PlacementDrive" ADD CONSTRAINT "PlacementDrive_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityRule" ADD CONSTRAINT "EligibilityRule_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementRound" ADD CONSTRAINT "PlacementRound_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PlacementRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_roundParticipantId_fkey" FOREIGN KEY ("roundParticipantId") REFERENCES "RoundParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


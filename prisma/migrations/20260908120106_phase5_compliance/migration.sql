-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('ATTENDANCE', 'MISCONDUCT', 'DOCUMENT_FRAUD', 'OFFER_RECIPROCITY', 'POLICY_VIOLATION', 'ACADEMIC_INTEGRITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('ELIGIBLE', 'CONDITIONAL', 'RESTRICTED', 'PLACED', 'DEBARRED');

-- CreateTable
CREATE TABLE "DisciplineIncident" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyId" TEXT,
    "driveId" TEXT,
    "violationType" "ViolationType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "actionTaken" TEXT,
    "adminRemarks" TEXT,
    "documentKey" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplineIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceOverride" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisciplineIncident_studentId_idx" ON "DisciplineIncident"("studentId");

-- CreateIndex
CREATE INDEX "DisciplineIncident_companyId_idx" ON "DisciplineIncident"("companyId");

-- CreateIndex
CREATE INDEX "DisciplineIncident_status_idx" ON "DisciplineIncident"("status");

-- CreateIndex
CREATE INDEX "DisciplineIncident_severity_idx" ON "DisciplineIncident"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceOverride_studentId_key" ON "ComplianceOverride"("studentId");

-- AddForeignKey
ALTER TABLE "DisciplineIncident" ADD CONSTRAINT "DisciplineIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineIncident" ADD CONSTRAINT "DisciplineIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineIncident" ADD CONSTRAINT "DisciplineIncident_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

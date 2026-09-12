-- CreateIndex
CREATE INDEX "AcademicRecord_currentCgpa_idx" ON "AcademicRecord"("currentCgpa");

-- CreateIndex
CREATE INDEX "Application_driveId_status_idx" ON "Application"("driveId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");

-- CreateIndex
CREATE INDEX "Student_branchId_batchId_idx" ON "Student"("branchId", "batchId");

-- Phase 16 — P1.2: server/services/search.service.ts's global search does
-- substring matching (`contains`, case-insensitive — ILIKE '%q%') against
-- Student.enrollmentNumber/firstName/lastName, Company.name, JobRole.title,
-- and PlacementDrive.title. A plain btree index only helps a *prefix*
-- match ('q%'), not a substring one — at 1000+ students/dozens of
-- companies/drives, every keystroke in the search box becomes a full table
-- scan on each of these without trigram indexes. pg_trgm + GIN indexes
-- make ILIKE '%q%' use the index. Requires the pg_trgm extension, which
-- Neon and Supabase both allow via CREATE EXTENSION (no superuser needed
-- on either managed platform).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Student_enrollmentNumber_trgm_idx" ON "Student" USING gin ("enrollmentNumber" gin_trgm_ops);
CREATE INDEX "Student_firstName_trgm_idx" ON "Student" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX "Student_lastName_trgm_idx" ON "Student" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX "Company_name_trgm_idx" ON "Company" USING gin ("name" gin_trgm_ops);
CREATE INDEX "JobRole_title_trgm_idx" ON "JobRole" USING gin ("title" gin_trgm_ops);
CREATE INDEX "PlacementDrive_title_trgm_idx" ON "PlacementDrive" USING gin ("title" gin_trgm_ops);

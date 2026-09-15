-- Phase 19: "applications open/closed" is no longer a manually-set
-- DriveStatus value — it's derived from applicationOpenAt/
-- applicationCloseAt whenever a drive is PUBLISHED (see lib/drive-status.ts).
-- One-time backfill: collapse any existing rows sitting in the now-retired
-- APPLICATIONS_OPEN/APPLICATIONS_CLOSED sub-states back to PUBLISHED, which
-- is where the app's own real/derived logic will re-classify them from
-- their dates from this point on. The enum values themselves are left in
-- the schema (a Postgres enum can't drop a value without a full type
-- rebuild) but the application will never set them again.
UPDATE "PlacementDrive"
SET status = 'PUBLISHED'
WHERE status IN ('APPLICATIONS_OPEN', 'APPLICATIONS_CLOSED');

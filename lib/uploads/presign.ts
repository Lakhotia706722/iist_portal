/**
 * Direct-to-storage upload authorization — Phase 16, P5.
 *
 * One place that knows, per upload category, who's allowed to request an
 * upload URL and what storage key it lands under — every category keeps
 * its EXISTING authorization model (student-owns-their-own-stuff vs
 * admin-acting-on-a-target-entity) exactly as the old proxy-through-Next
 * routes enforced it; only the *mechanism* changes (presigned URL instead
 * of receiving raw bytes).
 *
 * Server-side validation still happens here, before a URL is even issued
 * (declared type/size) — Phase 5's P8 requirement doesn't relax just
 * because bytes no longer pass through this process. Each category's
 * *confirm* step (the existing per-feature route that records the
 * resulting key against a DB row) re-validates what it can — a HEAD
 * check that the object actually exists at that key and, for storage
 * backends that expose it, its actual size — before trusting the client's
 * "I uploaded it" claim. See each confirm route's own comment.
 */
import { requireRole, requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getStorageAdapter, buildStorageKey } from "@/lib/storage";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertOfferOwnedByCallerIfCompanyRep } from "@/server/services/company-rep.service";

const STUDENT_DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const PPT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/jpeg",
  "image/png",
];

export interface PresignUploadRequest {
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Required for categories where the caller acts on behalf of another
   * entity (studentId for offer-letters/incident-evidence, driveId for
   * ppt, companyId for company-logos — omit for a brand-new company). */
  targetId?: string;
}

export interface PresignUploadResult {
  key: string;
  uploadUrl: string;
  /** The client MUST send this exact Content-Type header on the PUT — R2/S3's
   * presigned-URL signature covers it, so a mismatched header 403s at R2/S3,
   * not just cosmetically wrong metadata. */
  requiredContentType: string;
}

interface CategoryConfig {
  allowedMimeTypes: string[];
  maxBytes: number;
  storagePrefix: string;
  resolveOwnerId: (req: PresignUploadRequest) => Promise<string>;
}

async function ownStudentId(): Promise<string> {
  const user = await requireRole("STUDENT");
  return getStudentIdFromUserId(user.id);
}

function requireTargetId(req: PresignUploadRequest, label: string): string {
  if (!req.targetId) throw new ValidationError(`targetId (${label}) is required for category "${req.category}"`);
  return req.targetId;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  resumes: {
    allowedMimeTypes: ["application/pdf"],
    maxBytes: 5 * 1024 * 1024, // matches the pre-existing resume-versions limit
    storagePrefix: "resumes",
    resolveOwnerId: ownStudentId,
  },
  documents: {
    allowedMimeTypes: STUDENT_DOC_MIME_TYPES,
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "documents",
    resolveOwnerId: ownStudentId,
  },
  certifications: {
    allowedMimeTypes: STUDENT_DOC_MIME_TYPES,
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "certifications",
    resolveOwnerId: ownStudentId,
  },
  achievements: {
    allowedMimeTypes: STUDENT_DOC_MIME_TYPES,
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "achievements",
    resolveOwnerId: ownStudentId,
  },
  internships: {
    allowedMimeTypes: STUDENT_DOC_MIME_TYPES,
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "internships",
    resolveOwnerId: ownStudentId,
  },
  projects: {
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxBytes: 5 * 1024 * 1024,
    storagePrefix: "projects",
    resolveOwnerId: ownStudentId,
  },
  videos: {
    allowedMimeTypes: VIDEO_MIME_TYPES,
    maxBytes: 100 * 1024 * 1024,
    storagePrefix: "videos",
    resolveOwnerId: ownStudentId,
  },
  "offer-letters": {
    allowedMimeTypes: ["application/pdf"],
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "offer-letters",
    // targetId here is the OFFER id (what the admin UI actually has at
    // upload time) — looked up server-side to get the real studentId,
    // rather than trusting a client-supplied studentId, and re-runs the
    // same company-rep ownership check the confirm route already does
    // (offer:write is also held by COMPANY_REP) so a rep can't even get
    // an upload URL for another company's offer.
    resolveOwnerId: async (req) => {
      const user = await requirePermission("offer:write");
      const offerId = requireTargetId(req, "offerId");
      await assertOfferOwnedByCallerIfCompanyRep(offerId, user as { id: string; role?: string });
      const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { studentId: true } });
      if (!offer) throw new NotFoundError("Offer not found");
      return offer.studentId;
    },
  },
  "incident-evidence": {
    allowedMimeTypes: STUDENT_DOC_MIME_TYPES,
    maxBytes: 10 * 1024 * 1024,
    storagePrefix: "incident-evidence",
    // targetId here is the INCIDENT id (what the admin UI actually has at
    // upload time) — looked up server-side for the real studentId.
    resolveOwnerId: async (req) => {
      await requirePermission("incident:write");
      const incidentId = requireTargetId(req, "incidentId");
      const incident = await prisma.disciplineIncident.findUnique({ where: { id: incidentId }, select: { studentId: true } });
      if (!incident) throw new NotFoundError("Incident not found");
      return incident.studentId;
    },
  },
  ppt: {
    allowedMimeTypes: PPT_MIME_TYPES,
    maxBytes: 20 * 1024 * 1024,
    storagePrefix: "ppt-attachments", // matches the pre-existing key prefix
    resolveOwnerId: async (req) => {
      await requirePermission("drive:write");
      return requireTargetId(req, "driveId");
    },
  },
  "company-logos": {
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxBytes: 2 * 1024 * 1024,
    storagePrefix: "company-logos",
    resolveOwnerId: async (req) => {
      await requirePermission("company:write");
      // A brand-new company has no id yet — key it under "new" (the
      // confirm step still ties the resulting key to the real company
      // row once it's created/updated).
      return req.targetId ?? "new";
    },
  },
};

export async function createPresignedUpload(req: PresignUploadRequest): Promise<PresignUploadResult> {
  const config = CATEGORIES[req.category];
  if (!config) throw new ValidationError(`Unknown upload category: "${req.category}"`);

  if (!config.allowedMimeTypes.includes(req.mimeType)) {
    throw new ValidationError(
      `Unsupported file type "${req.mimeType || "unknown"}" for ${req.category}. Allowed: ${config.allowedMimeTypes.join(", ")}`
    );
  }
  if (req.sizeBytes > config.maxBytes) {
    throw new ValidationError(`File must be ${Math.round(config.maxBytes / (1024 * 1024))}MB or smaller`);
  }

  // Authorization runs AFTER the cheap type/size checks (fail fast on the
  // free checks) but BEFORE any key is minted or URL issued.
  const ownerId = await config.resolveOwnerId(req);
  const key = buildStorageKey(config.storagePrefix, ownerId, req.fileName);
  const uploadUrl = await getStorageAdapter().getPresignedUploadUrl(key, req.mimeType);

  return { key, uploadUrl, requiredContentType: req.mimeType };
}

/**
 * Confirm step helper: verify the object actually landed at `key` before
 * trusting the client's "I uploaded it" claim — a client could call
 * confirm without ever actually PUTting the bytes (network failure,
 * closed tab, or deliberate abuse), which would otherwise leave a DB row
 * pointing at a file that doesn't exist.
 */
export async function verifyUploadedObject(key: string): Promise<void> {
  const exists = await getStorageAdapter().exists(key);
  if (!exists) {
    throw new ValidationError("Upload did not complete — no object found at the given key. Please upload again.");
  }
}

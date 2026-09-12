/**
 * Client-side direct-to-storage upload — Phase 16, P5.
 *
 * Replaces "build a FormData, POST it to my own API route" with the
 * 3-step presigned-URL flow: request a presigned URL (auth+type/size
 * checked server-side), PUT the file straight to storage (never through
 * a Next.js route), return the resulting key for the caller to send to
 * its existing confirm endpoint as plain JSON.
 *
 * Usage:
 *   const { uploadDirect, progress, isUploading } = useDirectUpload();
 *   const key = await uploadDirect(file, "resumes");
 *   await fetch("/api/student/resumes/x/versions", {
 *     method: "POST", headers: {"Content-Type":"application/json"},
 *     body: JSON.stringify({ key }),
 *   });
 */
import { useState, useCallback } from "react";

export interface DirectUploadOptions {
  /** Required for categories where you're uploading on behalf of another
   * entity — see lib/uploads/presign.ts's CATEGORIES for which. */
  targetId?: string;
}

export function useDirectUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadDirect = useCallback(
    async (file: File, category: string, options: DirectUploadOptions = {}): Promise<string> => {
      setIsUploading(true);
      setError(null);
      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            targetId: options.targetId,
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not prepare upload");
        }
        const { key, uploadUrl, requiredContentType } = await presignRes.json();

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": requiredContentType },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error("Upload to storage failed. Please try again.");
        }

        return key as string;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return { uploadDirect, isUploading, error };
}

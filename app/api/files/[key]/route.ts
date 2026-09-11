import { NextRequest } from "next/server";
import path from "path";
import { requireAuth, errorResponse } from "@/lib/rbac/server-guard";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves stored files with an auth gate.
 * The key is URL-encoded (e.g. "documents/studentId/uuid-file.pdf").
 * In S3 mode this route is not needed — signed URLs go directly to S3.
 *
 * Bytes come from the storage adapter; path-traversal is refused by the
 * adapter itself so no filesystem access happens here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    await requireAuth();

    const key = decodeURIComponent(params.key);
    const storage = getStorageAdapter();

    let buffer: Buffer;
    try {
      buffer = await storage.download(key);
    } catch (err) {
      if ((err as Error).message?.includes("path traversal")) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response("Not Found", { status: 404 });
    }

    // Infer MIME type from extension
    const ext = path.extname(key).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

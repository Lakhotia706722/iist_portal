import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/rbac/server-guard";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Serves locally stored files with auth gate.
 * The key is URL-encoded (e.g. "documents/studentId/uuid-file.pdf").
 * In S3 mode this route is not needed — the signed URLs go directly to S3.
 */
export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  try {
    await requireAuth();

    const key = decodeURIComponent(params.key);

    // Prevent path traversal
    const basePath = process.env.LOCAL_STORAGE_PATH ?? "./uploads";
    const absBase = path.resolve(basePath);
    const absFile = path.resolve(path.join(basePath, key));

    if (!absFile.startsWith(absBase + path.sep) && absFile !== absBase) {
      return new Response("Forbidden", { status: 403 });
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(absFile);
    } catch {
      return new Response("Not Found", { status: 404 });
    }

    // Infer MIME type from extension
    const ext = path.extname(absFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf":  "application/pdf",
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png":  "image/png",
      ".webp": "image/webp",
      ".mp4":  "video/mp4",
      ".webm": "video/webm",
      ".mov":  "video/quicktime",
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

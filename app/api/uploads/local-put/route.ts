/**
 * Local-storage-driver PUT target — Phase 16, P5.
 *
 * Only reachable when STORAGE_DRIVER=local (dev only — production always
 * uses STORAGE_DRIVER=s3, whose adapter returns a real R2/S3 presigned
 * URL and never touches this route at all). A browser can't PUT directly
 * to a local filesystem, so LocalStorageAdapter.getPresignedUploadUrl()
 * points here instead, with a short-lived HMAC signature (not a login
 * session — this URL is meant to be handed to <input> upload code the
 * same way a real presigned URL would be) so this can't be used as an
 * open arbitrary-file-write endpoint even in dev.
 */
import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage";
import { signLocalPutUrl } from "@/lib/storage/local-adapter";

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");

  if (!key || !exp || !sig) {
    return NextResponse.json({ error: "Missing key/exp/sig" }, { status: 400 });
  }
  if (Date.now() > Number(exp)) {
    return NextResponse.json({ error: "This upload URL has expired" }, { status: 410 });
  }
  const expected = signLocalPutUrl(key, Number(exp));
  if (sig !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const mimeType = request.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await request.arrayBuffer());
  await getStorageAdapter().upload(key, buffer, mimeType);

  return NextResponse.json({ ok: true, key });
}

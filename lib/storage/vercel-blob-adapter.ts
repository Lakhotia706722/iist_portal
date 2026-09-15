/**
 * Vercel Blob storage adapter — Phase 20 production fix.
 *
 * Chosen because it needs nothing beyond the Vercel account this project is
 * already deployed under: no separate Cloudflare/AWS account or credentials
 * to provision, unlike the S3 adapter (which stays the right choice for
 * anyone who already has an R2/S3 bucket — see s3-adapter.ts). The store is
 * connected to this project via OIDC (`vercel storage connect`), so the SDK
 * picks up credentials from the ambient `VERCEL_OIDC_TOKEN` automatically;
 * no `BLOB_READ_WRITE_TOKEN` is needed or read here.
 *
 * Blob has no real "private, server-only" object model like S3 — every
 * blob gets a public, unguessable URL the moment it's uploaded. This
 * adapter uploads with `access: "public"` (Blob's only supported mode) and
 * relies on the same thing local dev already relies on: the key itself
 * (`buildStorageKey`) embeds a random UUID, so the URL is unguessable even
 * though it isn't auth-gated. getSignedUrl() ignores `expiresInSeconds`
 * for the same reason — there's no expiring-link primitive to call here.
 */
import { put, del, head } from "@vercel/blob";
import type { StorageAdapter } from "./index";

export class VercelBlobStorageAdapter implements StorageAdapter {
  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await put(key, buffer, { access: "public", contentType: mimeType, addRandomSuffix: false });
    return key;
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    const meta = await head(key);
    return meta.url;
  }

  async download(key: string): Promise<Buffer> {
    const meta = await head(key);
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`Failed to download blob ${key}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    try {
      await head(key);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await del(key);
  }
}

/**
 * Storage abstraction — the ONLY way application code touches file storage.
 *
 * Never read or write files directly (no `fs`, no raw S3 client) outside an
 * adapter: the driver is swapped via STORAGE_DRIVER and direct access breaks
 * that contract.
 */

import { LocalStorageAdapter } from "./local-adapter";
import { S3StorageAdapter } from "./s3-adapter";

export interface StorageAdapter {
  /** Store bytes under `key`. Returns the key. */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  /** A URL the browser can fetch the object from. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Read the object back. Throws if it does not exist. */
  download(key: string): Promise<Buffer>;
  /** True when the object exists. */
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

let cached: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER ?? "local";
  cached = driver === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();
  return cached;
}

/** Test seam — drop the memoised adapter (e.g. after changing env). */
export function resetStorageAdapter(): void {
  cached = null;
}

/**
 * Build a storage key with a collision-proof filename.
 * Keys are hierarchical: `<prefix>/<ownerId>/<uuid>-<sanitised name>`.
 */
export function buildStorageKey(
  prefix: string,
  ownerId: string,
  fileName: string
): string {
  const safe = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".") // never let ".." survive into a key
    .replace(/^[._-]+/, "")
    .slice(-100);
  return `${prefix}/${ownerId}/${crypto.randomUUID()}-${safe}`;
}

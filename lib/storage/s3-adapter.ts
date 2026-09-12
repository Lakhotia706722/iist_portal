/**
 * S3-compatible storage adapter — Phase 6.
 *
 * Locked provider: **Cloudflare R2** (no egress fees — matters for resume/
 * certificate downloads at scale). R2's API is S3-compatible, so this same
 * adapter works unmodified against real AWS S3 too (set AWS_ENDPOINT_URL
 * accordingly) if that's ever preferred instead.
 *
 * @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner are now real
 * (non-optional) dependencies — see package.json. Only instantiated when
 * STORAGE_DRIVER=s3 (see lib/storage/index.ts), so local dev never needs
 * real credentials.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter } from "./index";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. STORAGE_DRIVER=s3 requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, ` +
        `AWS_S3_BUCKET, AWS_REGION, and (for R2) AWS_ENDPOINT_URL — see .env.example.`
    );
  }
  return value;
}

export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private region: string;
  private endpoint: string | undefined;
  private client: S3Client;

  constructor() {
    this.bucket = requireEnv("AWS_S3_BUCKET");
    // R2 uses the literal region "auto"; real AWS S3 uses a real region.
    this.region = process.env.AWS_REGION ?? "auto";
    this.endpoint = process.env.AWS_ENDPOINT_URL;

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      // R2 (and most S3-compatible targets behind a custom endpoint) need
      // path-style addressing; real AWS S3 without a custom endpoint does not.
      forcePathStyle: !!this.endpoint,
      credentials: {
        accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType })
    );
    return key;
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return presign(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async getPresignedUploadUrl(key: string, mimeType: string, expiresInSeconds = 300): Promise<string> {
    // Short expiry (5 min default) — this URL is single-purpose (upload
    // this one file, right now), unlike the longer-lived download URL above.
    return presign(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType }),
      { expiresIn: expiresInSeconds }
    );
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

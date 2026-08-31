/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S3 Storage Adapter — requires @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner.
 * Install: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * Only loaded at runtime when STORAGE_DRIVER=s3.
 *
 * We use eval-require to prevent webpack from statically analysing the
 * package specifiers at build time (they are optional peer dependencies).
 */
import type { StorageAdapter } from "./index";

// Indirection so webpack cannot statically resolve these optional deps
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const _require = (id: string) => require(/* webpackIgnore: true */ id);

export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private region: string;
  private endpoint: string | undefined;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? "iist-career-portal";
    this.region = process.env.AWS_REGION ?? "ap-south-1";
    this.endpoint = process.env.AWS_ENDPOINT_URL;
  }

  private getClient() {
    const { S3Client } = _require("@aws-sdk/client-s3");
    return new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: !!this.endpoint,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { PutObjectCommand } = _require("@aws-sdk/client-s3");
    const client = this.getClient();
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }));
    return key;
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { getSignedUrl } = _require("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = _require("@aws-sdk/client-s3");
    const client = this.getClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = _require("@aws-sdk/client-s3");
    const client = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

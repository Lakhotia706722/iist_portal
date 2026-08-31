export interface StorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function getStorageAdapter(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    // Lazy import so local dev doesn't need AWS SDK unless driver is s3
    const { S3StorageAdapter } = require("./s3-adapter");
    return new S3StorageAdapter();
  }
  const { LocalStorageAdapter } = require("./local-adapter");
  return new LocalStorageAdapter();
}

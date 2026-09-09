import fs from "fs/promises";
import path from "path";
import type { StorageAdapter } from "./index";

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private baseUrl: string;

  constructor() {
    this.basePath = process.env.LOCAL_STORAGE_PATH ?? "./uploads";
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = this.resolve(key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `${this.baseUrl}/api/files/${encodeURIComponent(key)}`;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Resolve a key inside basePath, refusing anything that escapes it. */
  private resolve(key: string): string {
    const absBase = path.resolve(this.basePath);
    const absFile = path.resolve(path.join(this.basePath, key));
    if (absFile !== absBase && !absFile.startsWith(absBase + path.sep)) {
      throw new Error("Invalid storage key: path traversal blocked");
    }
    return absFile;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolve(key);
    await fs.unlink(filePath).catch(() => {
      // ignore if file doesn't exist
    });
  }
}

/**
 * File Storage Utilities — Phase 3
 * Simple file upload handling for logos and documents
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

export async function uploadFile(
  fileOrBuffer: File | Buffer, 
  pathOrFolder?: string,
  contentType?: string
): Promise<UploadResult> {
  try {
    let buffer: Buffer;
    let filename: string;
    let size: number;

    if (fileOrBuffer instanceof Buffer) {
      // Legacy usage: uploadFile(buffer, path, contentType)
      buffer = fileOrBuffer;
      const filePath = pathOrFolder!;
      filename = filePath.split('/').pop() || 'file';
      size = buffer.length;
      
      // Create directory and save file
      const fullPath = join(process.cwd(), "public", filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, buffer);
      
      return {
        url: `/${filePath}`,
        filename,
        size,
      };
    } else {
      // New usage: uploadFile(file, folder)
      const file = fileOrBuffer as File;
      const folder = pathOrFolder || "uploads";
      
      // Create upload directory if it doesn't exist
      const uploadDir = join(process.cwd(), "public", folder);
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const fileExtension = file.name.split('.').pop();
      filename = `${randomUUID()}.${fileExtension}`;
      const filepath = join(uploadDir, filename);

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      return {
        url: `/${folder}/${filename}`,
        filename,
        size: file.size,
      };
    }
  } catch (error) {
    console.error("File upload error:", error);
    throw new Error("Failed to upload file");
  }
}

export async function deleteFile(url: string): Promise<boolean> {
  try {
    if (!url.startsWith('/')) return false;
    
    const filepath = join(process.cwd(), "public", url);
    const { unlink } = await import("fs/promises");
    await unlink(filepath);
    return true;
  } catch (error) {
    console.error("File deletion error:", error);
    return false;
  }
}

// Legacy upload function for existing code compatibility
export async function upload(
  path: string,
  buffer: Buffer,
  contentType?: string
): Promise<UploadResult> {
  return uploadFile(buffer, path, contentType);
}

// Legacy compatibility function for existing code
export function getStorageAdapter() {
  return {
    uploadFile,
    deleteFile,
    upload,  // legacy upload function
    delete: deleteFile,  // alias for compatibility
    getSignedUrl: async (key: string) => `/${key}`, // Simple URL for local storage
    exists: async (key: string) => true, // Placeholder
    copy: async (from: string, to: string) => ({ url: `/${to}` }), // Placeholder
  };
}
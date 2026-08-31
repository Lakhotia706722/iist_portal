import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { randomUUID } from "crypto";

export async function getStudentIdFromUserId(userId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return s.id;
}

/** Upload a file from multipart form. Returns the storage key. */
export async function uploadFile(
  file: File,
  prefix: string,
  studentId: string,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${prefix}/${studentId}/${randomUUID()}-${file.name}`;
  await getStorageAdapter().upload(key, buffer, file.type);
  return key;
}

/** Parse body: handles both JSON and multipart (returns parsed body + optional file key) */
export async function parseBodyWithOptionalFile(
  req: Request,
  fileField: string,
  storagePrefix: string,
  studentId: string,
): Promise<{ body: any; fileKey?: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await (req as any).formData();
    const body = JSON.parse(formData.get("data") as string);
    const file = formData.get(fileField) as File | null;
    const fileKey = file ? await uploadFile(file, storagePrefix, studentId) : undefined;
    return { body, fileKey };
  }
  return { body: await (req as any).json() };
}

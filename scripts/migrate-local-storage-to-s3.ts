/**
 * One-off migration: copy every file under LOCAL_STORAGE_PATH into the S3
 * (R2) bucket configured by the AWS_* env vars, preserving keys — no DB
 * rewrite is needed since local and S3 adapters use the same key scheme
 * (buildStorageKey() output is driver-agnostic).
 *
 * Run BEFORE flipping STORAGE_DRIVER to "s3" in production:
 *   1. Keep STORAGE_DRIVER=local in .env (so this script reads local files)
 *   2. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION /
 *      AWS_S3_BUCKET / AWS_ENDPOINT_URL for the target bucket
 *   3. npx tsx scripts/migrate-local-storage-to-s3.ts
 *   4. Verify the printed summary, then flip STORAGE_DRIVER=s3 for real
 *
 * As of Phase 6, a DB scan found zero stored file keys anywhere in this
 * project (documents, resumes, offer letters, incident evidence, PPT
 * attachments, logos, project images, videos, certificates) — every prior
 * phase's "upload verification" exercised the JSON API surface, not an
 * actual multipart upload. This script has nothing to do today; it exists
 * so a real migration is a single command if local test files ever appear
 * before the real cutover.
 */

import { readdir, stat, readFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const LOCAL_PATH = process.env.LOCAL_STORAGE_PATH ?? "./uploads";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
};

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    console.error("AWS_S3_BUCKET is not set — configure the target bucket before running this.");
    process.exit(1);
  }

  const client = new S3Client({
    region: process.env.AWS_REGION ?? "auto",
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: !!process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  let found = 0;
  let uploaded = 0;
  let skippedExisting = 0;
  let failed = 0;

  for await (const filePath of walk(LOCAL_PATH)) {
    found++;
    const key = path.relative(LOCAL_PATH, filePath).split(path.sep).join("/");
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";

    try {
      // Don't clobber an object that's already there from a prior partial run.
      let exists = false;
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        exists = true;
      } catch {
        /* not found — proceed to upload */
      }
      if (exists) {
        skippedExisting++;
        continue;
      }

      const buffer = await readFile(filePath);
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType })
      );
      uploaded++;
      console.log(`  uploaded: ${key} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${key} — ${(err as Error).message}`);
    }
  }

  console.log("\n=== Migration summary ===");
  console.log(`Found locally: ${found}`);
  console.log(`Uploaded:      ${uploaded}`);
  console.log(`Already there: ${skippedExisting}`);
  console.log(`Failed:        ${failed}`);

  if (found === 0) {
    console.log(
      "\nNo local files found under " + LOCAL_PATH + " — nothing to migrate. " +
        "This is expected as of Phase 6 (see the header comment in this script)."
    );
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

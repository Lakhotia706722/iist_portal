/**
 * Storage adapter end-to-end check — runs against whichever STORAGE_DRIVER
 * is currently set. Run once with the default ("local") to prove the harness
 * itself is correct, then again with STORAGE_DRIVER=s3 (and real AWS_* env
 * vars) to prove the exact same code path against the real bucket before
 * deploy — this is the P0.5 verification the Phase 6 checklist calls for.
 *
 * Exercises every real upload path in the app (resume PDF, certificate
 * image, offer letter PDF, PPT attachment) through buildStorageKey() +
 * getStorageAdapter(), not a synthetic key — so a pass here means the same
 * code the app actually runs works against the real target.
 *
 * Run: npx tsx scripts/verify-storage-adapter.ts
 */

import { getStorageAdapter, buildStorageKey, resetStorageAdapter } from "../lib/storage";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

async function checkOne(prefix: string, fileName: string, mimeType: string, body: string) {
  const storage = getStorageAdapter();
  const key = buildStorageKey(prefix, "verify-user", fileName);
  const buffer = Buffer.from(body);

  const returnedKey = await storage.upload(key, buffer, mimeType);
  returnedKey === key ? ok(`${prefix}: upload() returns the key unchanged`) : fail(`${prefix}: upload() returned a different key`);

  const exists = await storage.exists(key);
  exists ? ok(`${prefix}: exists() confirms the object is there`) : fail(`${prefix}: exists() says the object is missing right after upload`);

  const downloaded = await storage.download(key);
  downloaded.toString() === body
    ? ok(`${prefix}: download() returns the exact bytes uploaded`)
    : fail(`${prefix}: download() content mismatch`);

  const url = await storage.getSignedUrl(key);
  url && url.length > 0 ? ok(`${prefix}: getSignedUrl() -> ${url.slice(0, 60)}${url.length > 60 ? "…" : ""}`) : fail(`${prefix}: getSignedUrl() returned empty`);

  await storage.delete(key);
  const existsAfterDelete = await storage.exists(key);
  !existsAfterDelete
    ? ok(`${prefix}: delete() actually removed the object (not just a DB row — there is no DB row here)`)
    : fail(`${prefix}: object still exists after delete()`);
}

async function main() {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  console.log(`\n=== Storage adapter verification — STORAGE_DRIVER=${driver} ===\n`);

  resetStorageAdapter();

  // The four real upload paths named in the Phase 6 checklist.
  await checkOne("resumes", "verify-resume.pdf", "application/pdf", "%PDF-1.4 fake resume content for verification");
  await checkOne("student-documents", "verify-certificate.pdf", "application/pdf", "%PDF-1.4 fake certificate content for verification");
  await checkOne("offer-letters", "verify-offer.pdf", "application/pdf", "%PDF-1.4 fake offer letter content for verification");
  await checkOne("ppt-attachments", "verify-deck.pdf", "application/pdf", "%PDF-1.4 fake PPT deck content for verification");

  console.log(
    process.exitCode
      ? `\n=== FAILURES PRESENT (driver=${driver}) ===\n`
      : `\n=== Storage adapter verified end-to-end (driver=${driver}) ===\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getStorageAdapter, resetStorageAdapter, buildStorageKey } from "./index";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "iist-storage-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_PATH = dir;
  resetStorageAdapter();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  resetStorageAdapter();
});

describe("LocalStorageAdapter (via getStorageAdapter)", () => {
  it("round-trips upload -> exists -> download -> delete", async () => {
    const storage = getStorageAdapter();
    const key = buildStorageKey("offer-letters", "student-1", "offer letter.pdf");
    const body = Buffer.from("%PDF-1.4 fake offer letter");

    const returned = await storage.upload(key, body, "application/pdf");
    expect(returned).toBe(key);

    expect(await storage.exists(key)).toBe(true);
    expect((await storage.download(key)).toString()).toBe(body.toString());

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it("builds keys that are namespaced and sanitised", () => {
    const key = buildStorageKey("documents", "s1", "my resume (final)/../x.pdf");
    expect(key.startsWith("documents/s1/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key).not.toContain(" ");
  });

  it("serves a signed URL that points at the file route", async () => {
    const url = await getStorageAdapter().getSignedUrl("documents/s1/a.pdf");
    expect(url).toContain("/api/files/");
    expect(url).toContain(encodeURIComponent("documents/s1/a.pdf"));
  });

  it("refuses path traversal on download and delete", async () => {
    const storage = getStorageAdapter();
    await expect(storage.download("../../etc/passwd")).rejects.toThrow(
      /path traversal/
    );
    await expect(storage.delete("../../etc/passwd")).rejects.toThrow(
      /path traversal/
    );
  });

  it("reports missing objects rather than throwing on exists()", async () => {
    expect(await getStorageAdapter().exists("nope/missing.pdf")).toBe(false);
  });
});

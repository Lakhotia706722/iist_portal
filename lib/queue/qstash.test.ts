import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const publishJSON = vi.fn().mockResolvedValue({ messageId: "msg_1" });
const batchJSON = vi.fn().mockResolvedValue([{ messageId: "msg_1" }, { messageId: "msg_2" }]);

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn(function MockClient(this: any) {
    this.publishJSON = publishJSON;
    this.batchJSON = batchJSON;
  }),
}));

describe("lib/queue/qstash (mocked @upstash/qstash — no live Upstash credentials in this session)", () => {
  const originalToken = process.env.QSTASH_TOKEN;
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.resetModules();
    publishJSON.mockClear();
    batchJSON.mockClear();
  });

  afterEach(() => {
    process.env.QSTASH_TOKEN = originalToken;
    process.env.NEXT_PUBLIC_APP_URL = originalUrl;
  });

  it("isQueueConfigured() reflects QSTASH_TOKEN presence", async () => {
    delete process.env.QSTASH_TOKEN;
    const unconfigured = await import("./qstash");
    expect(unconfigured.isQueueConfigured()).toBe(false);

    vi.resetModules();
    process.env.QSTASH_TOKEN = "test-token";
    const configured = await import("./qstash");
    expect(configured.isQueueConfigured()).toBe(true);
  });

  it("enqueueJob() publishes one message to the given endpoint, under the app's base URL", async () => {
    process.env.QSTASH_TOKEN = "test-token";
    process.env.NEXT_PUBLIC_APP_URL = "https://portal.example.edu";
    const { enqueueJob } = await import("./qstash");

    await enqueueJob("/api/jobs/send-email", { to: "a@x.com", subject: "s", html: "<p>x</p>" });

    expect(publishJSON).toHaveBeenCalledTimes(1);
    expect(publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://portal.example.edu/api/jobs/send-email",
        body: { to: "a@x.com", subject: "s", html: "<p>x</p>" },
      })
    );
  });

  it("enqueueJob() throws (not a silent no-op) when QSTASH_TOKEN is unset — callers must handle the fallback themselves", async () => {
    delete process.env.QSTASH_TOKEN;
    const { enqueueJob } = await import("./qstash");
    await expect(enqueueJob("/api/jobs/send-email", {})).rejects.toThrow(/QSTASH_TOKEN/);
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("enqueueJobs() batches every recipient into one QStash API call, not one per recipient", async () => {
    process.env.QSTASH_TOKEN = "test-token";
    const { enqueueJobs } = await import("./qstash");

    const bodies = Array.from({ length: 300 }, (_, i) => ({ to: `student${i}@x.com`, subject: "Shortlisted" }));
    await enqueueJobs("/api/jobs/send-email", bodies);

    // The whole point: 300 recipients -> 1 call to batchJSON, not 300
    // separate publishJSON round-trips.
    expect(batchJSON).toHaveBeenCalledTimes(1);
    expect(publishJSON).not.toHaveBeenCalled();
    const [[batchArg]] = batchJSON.mock.calls;
    expect(batchArg).toHaveLength(300);
    expect(batchArg[0]).toMatchObject({ url: expect.stringContaining("/api/jobs/send-email"), body: bodies[0] });
  });

  it("enqueueJobs() is a no-op for an empty list (never calls QStash)", async () => {
    process.env.QSTASH_TOKEN = "test-token";
    const { enqueueJobs } = await import("./qstash");
    await enqueueJobs("/api/jobs/send-email", []);
    expect(batchJSON).not.toHaveBeenCalled();
  });
});

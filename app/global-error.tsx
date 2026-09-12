"use client";

/**
 * Phase 16 — P7: top-level error boundary. React render errors that
 * escape every nested error.tsx land here — without this file, the app
 * had no boundary at all above the root layout, and neither did Sentry's
 * client SDK have anything to hook into for capturing them. Sentry.
 * captureException() runs even without SENTRY_DSN configured — no-DSN
 * makes reporting a no-op, not this handler.
 */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ color: "#666", marginTop: 8 }}>
              This has been reported. Please try reloading the page.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

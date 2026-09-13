import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Only ever called once sendEmail() has confirmed SMTP_USER is set.
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: parseInt(process.env.SMTP_PORT ?? "1025"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "IIST Placement Cell <noreply@iist.ac.in>";

  // Falls back to a console log whenever SMTP isn't configured — not
  // gated on NODE_ENV, deliberately: `next build && next start` (what CI
  // and this app's own E2E suite run) sets NODE_ENV=production same as a
  // real deploy, but has no more real SMTP available than local dev does.
  // A genuine production deployment always has SMTP_USER set (see
  // LAUNCH_CHECKLIST.md's launch-readiness requirement for it), so this
  // never masks a real misconfiguration there — it only stopped CI's
  // first-ever email-sending test path (Phase 17 P4's student
  // provisioning) from crashing with ECONNREFUSED trying to reach a
  // mail server that was never going to exist in that environment.
  if (!process.env.SMTP_USER) {
    console.log("─── [EMAIL - DEV CONSOLE] ───────────────────────────");
    console.log(`To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body:\n${options.text ?? "(html only)"}`);
    console.log("─────────────────────────────────────────────────────");
    return;
  }

  const transporter = createTransport();
  await transporter.sendMail({
    from,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });
}

/** Interpolate {{variable}} placeholders in a template string */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

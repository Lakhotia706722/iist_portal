import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = parseInt(process.env.SMTP_PORT ?? "1025");
  const secure = process.env.SMTP_SECURE === "true";

  // Dev: if no real SMTP, fall through to console transport
  if (!process.env.SMTP_USER && process.env.NODE_ENV !== "production") {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      ignoreTLS: true,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "IIST Placement Cell <noreply@iist.ac.in>";

  // In dev with no SMTP, just log the email to console
  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_USER) {
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

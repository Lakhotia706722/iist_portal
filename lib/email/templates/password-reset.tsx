import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
  /** "reset" (default): existing user asked to reset their password.
   *  "welcome": a newly provisioned account setting its first password. */
  variant?: "reset" | "welcome";
}

export function PasswordResetEmail({
  userName,
  resetUrl,
  expiresInMinutes = 60,
  variant = "reset",
}: PasswordResetEmailProps) {
  const isWelcome = variant === "welcome";
  const previewText = isWelcome
    ? "Set up your IIST Placement Portal account"
    : "Reset your IIST Placement Portal password";
  const heading = isWelcome ? "Welcome to the IIST Placement Portal" : "Password Reset Request";
  const intro = isWelcome
    ? "An account has been created for you on the IIST Placement Portal. Click the button below to set your password and activate your account."
    : "We received a request to reset your IIST Placement Portal password. Click the button below to set a new password.";
  const buttonLabel = isWelcome ? "Set Your Password" : "Reset Password";
  const footerNote = isWelcome
    ? "If you were not expecting this email, please contact the placement cell."
    : "If you did not request a password reset, please ignore this email or contact the placement cell if you have concerns.";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Inter, sans-serif" }}>
        <Container
          style={{
            margin: "40px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "40px",
            maxWidth: "600px",
          }}
        >
          <Heading style={{ color: "#0f172a", fontSize: "24px", marginBottom: "16px" }}>
            {heading}
          </Heading>
          <Text style={{ color: "#475569", fontSize: "16px" }}>
            Hello {userName},
          </Text>
          <Text style={{ color: "#475569", fontSize: "16px" }}>
            {intro} This link expires in {expiresInMinutes} minutes.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                borderRadius: "6px",
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              {buttonLabel}
            </Button>
          </Section>
          <Text style={{ color: "#94a3b8", fontSize: "14px" }}>
            {footerNote}
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "32px" }}>
            IIST Placement Cell · Indore, Madhya Pradesh, India
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;

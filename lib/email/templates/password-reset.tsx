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
}

export function PasswordResetEmail({
  userName,
  resetUrl,
  expiresInMinutes = 60,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your IIST Placement Portal password</Preview>
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
            Password Reset Request
          </Heading>
          <Text style={{ color: "#475569", fontSize: "16px" }}>
            Hello {userName},
          </Text>
          <Text style={{ color: "#475569", fontSize: "16px" }}>
            We received a request to reset your IIST Placement Portal password. Click the
            button below to set a new password. This link expires in {expiresInMinutes}{" "}
            minutes.
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
              Reset Password
            </Button>
          </Section>
          <Text style={{ color: "#94a3b8", fontSize: "14px" }}>
            If you did not request a password reset, please ignore this email or contact
            the placement cell if you have concerns.
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "32px" }}>
            IIST Placement Cell · Thiruvananthapuram, Kerala, India
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;

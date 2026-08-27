import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface VerificationEmailProps {
  otp: string;
  expiresInMinutes?: number;
}

export function VerificationEmail({ otp, expiresInMinutes = 5 }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Easy Auth verification code: {otp}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Verify your email address</Heading>
          <Text style={textStyle}>
            Please use the following single-use verification code to complete your Easy Auth
            registration:
          </Text>
          <Section style={codeBoxStyle}>
            <Text style={codeStyle}>{otp}</Text>
          </Section>
          <Text style={textStyle}>
            This verification code is valid for {expiresInMinutes} minutes.
          </Text>
          <Text style={warningStyle}>
            If you did not request this verification code, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const mainStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "24px 0",
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const headingStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "600",
  marginBottom: "16px",
  marginTop: "0",
};

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "12px 0",
};

const codeBoxStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  margin: "24px 0",
  padding: "16px",
  textAlign: "center" as const,
};

const codeStyle: React.CSSProperties = {
  color: "#111827",
  fontFamily: "monospace",
  fontSize: "28px",
  fontWeight: "700",
  letterSpacing: "6px",
  margin: "0",
};

const warningStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  marginTop: "24px",
};

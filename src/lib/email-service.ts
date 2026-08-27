import { Resend } from "resend";
import * as React from "react";

import { PasswordResetEmail } from "../emails/password-reset-email";
import { VerificationEmail } from "../emails/verification-email";

export type AuthEmailPurpose = "email-verification" | "password-reset";

export interface AuthEmailMessage {
  purpose: AuthEmailPurpose;
  to: string;
  otp: string;
  expiresInMinutes?: number;
}

export type AuthEmailSender = (message: AuthEmailMessage) => Promise<void>;

export interface ResendEmailConfig {
  apiKey?: string;
  from?: string;
}

export function getAuthEmailContent(message: AuthEmailMessage): {
  subject: string;
  react: React.ReactElement;
} {
  const props = {
    otp: message.otp,
    expiresInMinutes: message.expiresInMinutes ?? 5,
  };

  if (message.purpose === "password-reset") {
    return {
      subject: "Your Easy Auth password reset code",
      react: React.createElement(PasswordResetEmail, props),
    };
  }

  return {
    subject: "Your Easy Auth verification code",
    react: React.createElement(VerificationEmail, props),
  };
}

export function createResendEmailSender({ apiKey, from }: ResendEmailConfig): AuthEmailSender {
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");
  }

  const resend = new Resend(apiKey);

  return async (message) => {
    const content = getAuthEmailContent(message);
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      ...content,
    });

    if (error) {
      throw new Error("Resend rejected authentication email delivery", { cause: error });
    }
  };
}

export async function deliverAuthEmail(
  message: AuthEmailMessage,
  sender: AuthEmailSender,
): Promise<void> {
  await sender(message);
}

export function scheduleBackgroundTask(
  task: Promise<unknown>,
  waitUntil: (task: Promise<unknown>) => void,
  onError: (error: unknown) => void = (error) =>
    console.error("Background email delivery failed", error),
): void {
  waitUntil(task.catch(onError));
}

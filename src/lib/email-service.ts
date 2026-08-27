import { Resend } from "resend";
import * as React from "react";

import { VerificationEmail } from "../emails/verification-email";

export interface VerificationEmailMessage {
  to: string;
  otp: string;
  expiresInMinutes?: number;
}

export type VerificationEmailSender = (message: VerificationEmailMessage) => Promise<void>;

export interface ResendEmailConfig {
  apiKey?: string;
  from?: string;
}

export function createResendEmailSender({
  apiKey,
  from,
}: ResendEmailConfig): VerificationEmailSender {
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");
  }

  const resend = new Resend(apiKey);

  return async (message) => {
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: "Your Easy Auth verification code",
      react: React.createElement(VerificationEmail, {
        otp: message.otp,
        expiresInMinutes: message.expiresInMinutes ?? 5,
      }),
    });

    if (error) {
      throw new Error("Resend rejected verification email delivery", { cause: error });
    }
  };
}

export async function deliverVerificationEmail(
  message: VerificationEmailMessage,
  sender: VerificationEmailSender,
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

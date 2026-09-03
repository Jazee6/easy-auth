import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { normalizeEmail } from "@/lib/auth-policy";
import { privatePageHead } from "@/lib/page-metadata";

const searchSchema = v.object({
  email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
  action: v.optional(v.picklist(["set", "reset"])),
});

export const Route = createFileRoute("/forgot-password")({
  head: () => privatePageHead("Reset password"),
  validateSearch: (search) => {
    const result = v.safeParse(searchSchema, search);
    if (!result.success) {
      return {};
    }

    return {
      ...(result.output.email ? { email: normalizeEmail(result.output.email) } : {}),
      ...(result.output.action ? { action: result.output.action } : {}),
    };
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email, action } = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm initialEmail={email} action={action} />
      </div>
    </div>
  );
}

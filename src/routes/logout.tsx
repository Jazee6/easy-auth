import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

import { LogoutCard } from "@/components/logout-card";
import { logoutSearchSchema, type LogoutSearch } from "@/lib/logout-presentation";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/logout")({
  head: () => privatePageHead("Sign out"),
  validateSearch: (search): LogoutSearch => {
    const result = v.safeParse(logoutSearchSchema, search);
    return result.success ? result.output : { step: "error" };
  },
  component: LogoutPage,
});

function LogoutPage() {
  const search = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LogoutCard {...search} />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { AuthorizedApplications } from "@/components/authorized-applications";
import { listApplicationAuthorizations } from "@/lib/oauth-server";

export const Route = createFileRoute("/_account/authorized-applications")({
  staticData: { title: "Authorized applications" },
  loader: () => listApplicationAuthorizations(),
  component: AuthorizedApplicationsPage,
});

function AuthorizedApplicationsPage() {
  const applications = Route.useLoaderData();
  return <AuthorizedApplications applications={applications} />;
}

import { createFileRoute } from "@tanstack/react-router";

import { AuthorizedApplications } from "@/components/authorized-applications";
import { listApplicationAuthorizations } from "@/lib/oauth-server";

export const Route = createFileRoute("/_account/applications")({
  staticData: { title: "Applications" },
  loader: () => listApplicationAuthorizations(),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const applications = Route.useLoaderData();
  return <AuthorizedApplications applications={applications} />;
}

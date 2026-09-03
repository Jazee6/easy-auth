import { createFileRoute } from "@tanstack/react-router";

import { AuthorizedApplications } from "@/components/authorized-applications";
import { listApplicationAuthorizations } from "@/lib/oauth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/applications")({
  staticData: { title: "Applications" },
  head: () => privatePageHead("Applications"),
  loader: () => listApplicationAuthorizations(),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const applications = Route.useLoaderData();
  return <AuthorizedApplications applications={applications} />;
}

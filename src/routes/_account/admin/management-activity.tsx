import { createFileRoute } from "@tanstack/react-router";

import { ManagementActivity } from "@/components/management-activity";
import { listManagementActivity } from "@/lib/oauth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/admin/management-activity")({
  staticData: { title: "Management activity" },
  head: () => privatePageHead("Management activity"),
  loader: () => listManagementActivity(),
  component: ManagementActivityPage,
});

function ManagementActivityPage() {
  const activity = Route.useLoaderData();
  return <ManagementActivity activity={activity} />;
}

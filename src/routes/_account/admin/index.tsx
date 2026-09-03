import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/admin-dashboard";
import { getDashboard } from "@/lib/admin-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/admin/")({
  staticData: { title: "Dashboard" },
  head: () => privatePageHead("Admin dashboard"),
  loader: () => getDashboard(),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const dashboard = Route.useLoaderData();
  return <AdminDashboard dashboard={dashboard} />;
}

import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/admin-dashboard";
import { getDashboard } from "@/lib/admin-server";

export const Route = createFileRoute("/_account/admin/")({
  staticData: { title: "Dashboard" },
  loader: () => getDashboard(),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const dashboard = Route.useLoaderData();
  return <AdminDashboard dashboard={dashboard} />;
}

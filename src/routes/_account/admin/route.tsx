import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminAccessForbidden } from "@/components/admin-access-forbidden";
import { assertAdministratorRouteAccess, isAdministratorAccessError } from "@/lib/admin-policy";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/admin")({
  head: () => privatePageHead("Admin"),
  beforeLoad: ({ context }) => {
    assertAdministratorRouteAccess(context.session.user.role);
  },
  component: Outlet,
  errorComponent: ({ error }) => {
    if (!isAdministratorAccessError(error)) throw error;
    return <AdminAccessForbidden />;
  },
});

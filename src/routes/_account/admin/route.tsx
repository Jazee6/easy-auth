import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminAccessForbidden } from "@/components/admin-access-forbidden";
import { assertAdministratorRouteAccess, isAdministratorAccessError } from "@/lib/admin-policy";

export const Route = createFileRoute("/_account/admin")({
  beforeLoad: ({ context }) => {
    assertAdministratorRouteAccess(context.session.user.role);
  },
  component: Outlet,
  errorComponent: ({ error }) => {
    if (!isAdministratorAccessError(error)) throw error;
    return <AdminAccessForbidden />;
  },
});

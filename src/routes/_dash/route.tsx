import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { CSSProperties } from "react";
import Sidebar from "@/components/sidebar";
import { Header } from "@/components/sidebar/header.tsx";
import Footer from "@/components/footer.tsx";
import { getSession } from "@/routes";
import AlertDialog from "@/components/alert-dialog.tsx";

// const getDefaultOpen = createServerFn().handler(() => {
//   const cookie = getRequestHeader("Cookie");
//   return !cookie?.includes("sidebar_state=false");
// });

export const Route = createFileRoute("/_dash")({
  component: _Layout,
  beforeLoad: async () => getSession(),
});

function _Layout() {
  const { session } = Route.useRouteContext();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <Sidebar variant="inset" session={session} />

      <SidebarInset className="relative">
        <Header />

        <main className="p-4 lg:p-6 h-full">
          <Outlet />
        </main>

        <Footer classname="absolute bottom-2 left-1/2 -translate-x-1/2" />

        <AlertDialog />
      </SidebarInset>
    </SidebarProvider>
  );
}

import useSWR from "swr";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar.tsx";
import { AppSidebar } from "@/components/sidebar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { User } from "@/lib/types.ts";
import { useCookie } from "@/lib/hooks.ts";
import { Outlet } from "react-router";

const Layout = () => {
  const { data: user } = useSWR<User>("/profile");

  const sidebar_state = useCookie("sidebar_state");

  if (!sidebar_state) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={sidebar_state !== "false"}>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
        </header>

        <main className="p-5 h-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;

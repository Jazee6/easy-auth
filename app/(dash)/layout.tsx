import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CSSProperties } from "react";
import Sidebar from "@/components/sidebar";
import Footer from "@/components/footer";
import { Header } from "@/components/sidebar/header";
import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QueryClient from "@/components/query-client";

const Index = async ({ children }: LayoutProps<"/">) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
      defaultOpen={defaultOpen}
    >
      <Sidebar variant="inset" session={session} />
      <SidebarInset className="relative">
        <Header />

        <QueryClient>
          <main className="p-4 lg:p-6 h-full">{children}</main>
        </QueryClient>

        <Footer classname="absolute bottom-2 left-1/2 -translate-x-1/2" />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;

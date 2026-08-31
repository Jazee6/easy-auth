import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Activity, AppWindow, IdCard, KeyRound, ShieldCheck, User } from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({
  user,
  ...props
}: {
  user: {
    name: string;
    email: string;
    image?: string | null;
    role?: string | null;
  };
} & React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const isProfileActive = location.pathname === "/profile";
  const isSignInMethodsActive = location.pathname === "/sign-in-methods";
  const isAuthorizationsActive = location.pathname === "/authorized-applications";
  const isOAuthClientsActive = location.pathname.startsWith("/admin/oauth-clients");
  const isActivityActive = location.pathname === "/admin/management-activity";
  const isAdministrator = user.role?.split(",").includes("admin") ?? false;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link to="/profile">
                  <div className="flex aspect-square size-8 items-center justify-center">
                    <IdCard className="size-4" />
                  </div>
                  <span className="truncate font-semibold">Easy Auth</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isProfileActive}
                  tooltip="Profile"
                  render={
                    <Link to="/profile">
                      <User className="size-4" />
                      <span>Profile</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isSignInMethodsActive}
                  tooltip="Sign-in methods"
                  render={
                    <Link to="/sign-in-methods">
                      <KeyRound className="size-4" />
                      <span>Sign-in methods</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isAuthorizationsActive}
                  tooltip="Authorized applications"
                  render={
                    <Link to="/authorized-applications">
                      <ShieldCheck className="size-4" />
                      <span>Authorized applications</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdministrator && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isOAuthClientsActive}
                    tooltip="OAuth clients"
                    render={
                      <Link to="/admin/oauth-clients">
                        <AppWindow className="size-4" />
                        <span>OAuth clients</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActivityActive}
                    tooltip="Management activity"
                    render={
                      <Link to="/admin/management-activity">
                        <Activity className="size-4" />
                        <span>Management activity</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { IdCard, User } from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  };
} & React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const isProfileActive = location.pathname === "/profile";

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

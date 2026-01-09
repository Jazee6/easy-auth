"use client";

import { type ReactElement } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LoadingIndicator from "@/components/loading-indicator";

export function NavMain({
  items,
  groupLabel,
}: {
  items: {
    title: string;
    url: string;
    icon?: ReactElement;
  }[];
  groupLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      {groupLabel ? <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                asChild
              >
                <Link href={item.url}>
                  {item.icon}
                  <span>{item.title}</span>

                  <LoadingIndicator className="ml-auto" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

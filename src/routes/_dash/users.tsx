import { createFileRoute, redirect } from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { UserWithRole } from "better-auth/plugins";
import { useState } from "react";
import DataTable from "@/components/table/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";

type User = UserWithRole;

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "image",
    header: "Image",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <Avatar>
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      return createdAt.toLocaleString();
    },
  },
];

export const Route = createFileRoute("/_dash/users")({
  component: RouteComponent,
  staticData: {
    title: "Users",
  },
  head: () => ({
    meta: [
      {
        title: `Users - ${appName}`,
      },
      {
        name: "description",
        content: `Manage your users on ${appName}.`,
      },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "admin") {
      throw redirect({
        to: "/login",
      });
    }
  },
});

function RouteComponent() {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  const {
    data = {
      users: [],
      total: 0,
    },
    isLoading,
  } = useQuery({
    queryKey: ["admin", "listUsers", pagination],
    queryFn: async () => {
      const { data } = await authClient.admin.listUsers({
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
        },
      });

      return (
        data ?? {
          users: [],
          total: 0,
        }
      );
    },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <DataTable
        columns={columns}
        data={data.users}
        isLoading={isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowCount={data.total}
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { UAParser } from "ua-parser-js";
import DataTable from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { showAlertDialog } from "@/components/alert-dialog";
import { appName } from "@/lib/constants.ts";

interface Session {
  id: string;
  browser: string;
  updatedAt: string;
  token: string;
}

export const Route = createFileRoute("/_dash/sessions")({
  component: RouteComponent,
  staticData: {
    title: "Sessions",
  },
  head: () => ({
    meta: [
      {
        title: `Sessions - ${appName}`,
      },
      {
        name: "description",
        content: `Manage your sessions on ${appName}.`,
      },
    ],
  }),
});

function RouteComponent() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["listSessions"],
    queryFn: async () => {
      const { data } = await authClient.listSessions();

      return data?.map((session) => {
        const b = UAParser(session.userAgent ?? "").browser;

        return {
          id: session.id,
          browser: `${b.name ?? ""}/${b.major ?? ""}`,
          updatedAt: new Date(session.updatedAt).toLocaleString(),
          token: session.token,
        };
      });
    },
  });

  const columns: ColumnDef<Session>[] = [
    {
      accessorKey: "browser",
      header: "Browser",
    },
    {
      accessorKey: "updatedAt",
      header: "Updated At",
    },
    {
      header: "Actions",
      cell: ({ row }) => {
        return (
          <Button
            variant="link"
            className="text-destructive p-0"
            onClick={() =>
              showAlertDialog({
                title: "Are you sure you want to revoke this session?",
                description: "This action cannot be undone.",
                confirmText: "Revoke",
                onConfirmAction: async () =>
                  await authClient.revokeSession({
                    token: row.original.token,
                  }),
              })
            }
          >
            Revoke
          </Button>
        );
      },
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <DataTable columns={columns} data={data} isLoading={isLoading} />
    </div>
  );
}

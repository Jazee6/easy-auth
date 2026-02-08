import { createFileRoute, redirect } from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import DataTable from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { showAlertDialog } from "@/components/alert-dialog";
import { oauthClient } from "@/db/schema/auth.ts";
import { useServerFn } from "@tanstack/react-start";
import { deleteApp, getApps } from "@/lib/actions.ts";
import AppDrawer from "@/components/app-drawer.tsx";

export type TableItem = typeof oauthClient.$inferSelect;

export const Route = createFileRoute("/_dash/apps")({
  component: RouteComponent,
  staticData: {
    title: "Apps",
  },
  head: () => ({
    meta: [
      {
        title: `Apps - ${appName}`,
      },
      {
        name: "description",
        content: `Manage your apps on ${appName}.`,
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
  const [appDialogOpen, setAppDialogOpen] = useState(false);
  const [rowData, setRowData] = useState<TableItem>();
  const getAppsServer = useServerFn(getApps);
  const deleteAppServer = useServerFn(deleteApp);

  const {
    data = {
      res: [],
      total: 0,
    },
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "getApps", pagination],
    queryFn: async () => {
      const { res, total } = await getAppsServer({
        data: pagination,
      });

      return {
        res,
        total,
      };
    },
  });

  const columns: ColumnDef<TableItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "clientId",
      header: "Client ID",
    },
    {
      accessorKey: "redirectUris",
      header: "Redirect URIs",
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        return createdAt?.toLocaleString();
      },
    },
    {
      id: "actions",
      header: "Actions",
      meta: {
        pin: "right",
      },
      cell: ({ row }) => {
        const onDelete = async () => {
          await deleteAppServer({
            data: {
              id: row.original.id,
            },
          });
          await refetch();
        };

        return (
          <div className="space-x-2">
            <Button
              variant="link"
              className="p-0"
              onClick={() => {
                setAppDialogOpen(true);
                setRowData(row.original);
              }}
            >
              Edit
            </Button>

            <Button
              variant="link"
              className="text-destructive p-0"
              onClick={() => {
                showAlertDialog({
                  onConfirmAction: onDelete,
                  title: "Are you sure you want to delete this app?",
                  description: "This action cannot be undone.",
                  confirmText: "Delete",
                });
              }}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div className="flex">
        <Button
          className="ml-auto"
          onClick={() => {
            setRowData(undefined);
            setAppDialogOpen(true);
          }}
        >
          Add +
        </Button>
      </div>

      <DataTable
        // @ts-expect-error TODO
        columns={columns}
        data={data.res}
        isLoading={isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowCount={data.total}
      />

      <AppDrawer
        open={appDialogOpen}
        onOpenChange={setAppDialogOpen}
        rowData={rowData}
        refetch={refetch}
      />
    </div>
  );
}

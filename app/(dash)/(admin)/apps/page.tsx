"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import DataTable from "@/components/table/data-table";
import { deleteApp, getApps } from "@/lib/actions";
import { oauthApplication } from "@/lib/db/schema/auth";
import { Button } from "@/components/ui/button";
import EditDialog from "@/app/(dash)/(admin)/apps/edit-dialog";
import AddDrawer from "@/app/(dash)/(admin)/apps/add-drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showAlertDialog } from "@/components/alert-dialog";

export type TableItem = typeof oauthApplication.$inferSelect;

const Page = () => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rowData, setRowData] = useState<TableItem>();

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
      const { res, total } = await getApps(pagination);

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
      accessorKey: "redirectURLs",
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
          await deleteApp(row.original.id);
          await refetch();
        };

        return (
          <div className="space-x-2">
            <Button
              variant="link"
              className="p-0"
              onClick={() => {
                setEditDialogOpen(true);
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
        <Button className="ml-auto" onClick={() => setAddDialogOpen(true)}>
          Add +
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data.res}
        isLoading={isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowCount={data.total}
      />

      <AddDrawer
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        refetch={refetch}
      />

      <EditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        rowData={rowData}
        refetch={refetch}
      />
    </div>
  );
};

export default Page;

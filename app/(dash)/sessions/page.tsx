"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { UAParser } from "ua-parser-js";
import DataTable from "@/components/data-table";
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
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

interface Session {
  id: string;
  browser: string;
  updatedAt: string;
  token: string;
}

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
      const session = row.original;

      const onRevoke = async () => {
        await authClient.revokeSession({
          token: session.token,
        });
      };

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="link" className="text-destructive p-0">
              Revoke
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure you want to revoke this session?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    },
  },
];

const Page = () => {
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

  return (
    <div className="max-w-3xl mx-auto">
      <DataTable columns={columns} data={data} isLoading={isLoading} />
    </div>
  );
};

export default Page;

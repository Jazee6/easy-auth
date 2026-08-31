import { Inbox } from "lucide-react";

import { tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const features = tableFeatures({});
export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof features, TData, unknown>;

export function DataTable<TData extends RowData>({
  data,
  columns,
  emptyMessage = "No results.",
  emptyDescription,
}: {
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  emptyMessage?: string;
  emptyDescription?: string;
}) {
  const table = useTable({ data, columns, features });
  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2 align-middle font-medium">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="align-middle" colSpan={columns.length}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Inbox />
                      </EmptyMedia>
                      <EmptyTitle>{emptyMessage}</EmptyTitle>
                      {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
                    </EmptyHeader>
                  </Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

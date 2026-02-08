import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type OnChangeFn,
  useReactTable,
} from "@tanstack/react-table";
import DataTablePagination from "@/components/table/data-table-pagination";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PaginationState } from "@tanstack/table-core";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  rowCount?: number;
}

export default function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  pagination,
  onPaginationChange,
  rowCount,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    initialState: {
      columnPinning: {
        left: columns
          .filter((col) => col.meta?.pin === "left" && col.id)
          .map((col) => col.id ?? ""),
        right: columns
          .filter((col) => col.meta?.pin === "right")
          .map((col) => col.id ?? ""),
      },
    },
    state: {
      pagination,
    },
    onPaginationChange,
    rowCount,
    manualPagination: true,
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.getIsPinned() === "right" &&
                          "sticky right-0 bg-background",
                        header.column.getIsPinned() === "left" &&
                          "sticky left-0 bg-background",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.getIsPinned() === "right" &&
                          "sticky right-0 bg-background",
                        cell.column.getIsPinned() === "left" &&
                          "sticky left-0 bg-background",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && <DataTablePagination table={table} className="mt-2" />}
    </>
  );
}

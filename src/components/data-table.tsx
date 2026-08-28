import { tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table";

const features = tableFeatures({});
export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof features, TData, unknown>;

export function DataTable<TData extends RowData>({
  data,
  columns,
  emptyMessage = "No results.",
}: {
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  emptyMessage?: string;
}) {
  const table = useTable({ data, columns, features });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="py-2 pr-4 font-medium">
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
                  <td key={cell.id} className="py-3 pr-4 align-top">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

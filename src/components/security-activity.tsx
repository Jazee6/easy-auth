import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarRange, Search, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { PageHeader } from "@/components/page-header";
import { SecurityActivityTable } from "@/components/security-activity-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SecurityActivityAction,
  SecurityActivityListResult,
  SecurityActivitySearch,
} from "@/lib/admin-security";
import { cn } from "@/lib/utils";

const actionOptions: Array<{ value: SecurityActivityAction; label: string }> = [
  { value: "ban", label: "Ban" },
  { value: "unban", label: "Unban" },
  { value: "revoke-session", label: "Revoke Session" },
  { value: "revoke-all-sessions", label: "Revoke all Sessions" },
];

function dateFromSearch(value?: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function searchDate(value?: Date): string | undefined {
  return value ? format(value, "yyyy-MM-dd") : undefined;
}

function paginationItems(page: number, totalPages: number): Array<number | "left" | "right"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: Array<number | "left" | "right"> = [1];
  if (page > 3) pages.push("left");
  for (
    let current = Math.max(2, page - 1);
    current <= Math.min(totalPages - 1, page + 1);
    current++
  ) {
    pages.push(current);
  }
  if (page < totalPages - 2) pages.push("right");
  pages.push(totalPages);
  return pages;
}

function DateRangeFilter({
  start,
  end,
  onApply,
}: {
  start?: string;
  end?: string;
  onApply: (range: { start?: string; end?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({
    from: dateFromSearch(start),
    to: dateFromSearch(end),
  });
  const label = start || end ? `${start ?? "Any"} – ${end ?? "Any"}` : "Any date";

  return (
    <Field className="w-full lg:w-auto">
      <FieldLabel htmlFor="security-date-range">Date range</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id="security-date-range"
          render={
            <Button variant="outline" className="w-full justify-start font-normal lg:w-64">
              <CalendarRange />
              {label}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto gap-3 p-3">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            defaultMonth={range?.from ?? range?.to}
            numberOfMonths={1}
          />
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRange(undefined);
                onApply({});
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply({ start: searchDate(range?.from), end: searchDate(range?.to) });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

export function SecurityActivity({
  result,
  search,
}: {
  result: SecurityActivityListResult;
  search: SecurityActivitySearch;
}) {
  const navigate = useNavigate({ from: "/admin/security-activity/" });
  const updateSearch = (change: Partial<SecurityActivitySearch>) =>
    navigate({ search: { ...search, ...change, page: change.page ?? 1 } });
  const clearFilters = () => navigate({ search: { q: "", page: 1 } });

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PageHeader
        title="Security activity"
        description="Best-effort operational history for Standard Account security actions."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <form
          noValidate
          className="flex min-w-0 flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            updateSearch({ q: typeof value === "string" ? value.trim() : "" });
          }}
        >
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="security-identity-search">Identity</FieldLabel>
            <Input
              key={search.q}
              id="security-identity-search"
              name="q"
              type="search"
              defaultValue={search.q}
              placeholder="Actor or target name/email"
            />
          </Field>
          <Button type="submit">
            <Search />
            Search
          </Button>
        </form>

        <Field className="w-full lg:w-auto">
          <FieldLabel id="security-action-label">Action</FieldLabel>
          <Select
            value={search.action ?? "all"}
            onValueChange={(value) =>
              updateSearch({
                action: value === "all" ? undefined : (value as SecurityActivityAction),
              })
            }
          >
            <SelectTrigger className="w-full lg:w-52" aria-labelledby="security-action-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DateRangeFilter
          key={`${search.start ?? ""}:${search.end ?? ""}`}
          start={search.start}
          end={search.end}
          onApply={({ start, end }) => updateSearch({ start, end })}
        />

        {(search.q || search.action || search.start || search.end) && (
          <Button variant="ghost" onClick={clearFilters}>
            <X />
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? "record" : "records"}
      </p>
      <SecurityActivityTable activity={result.activity} global />

      {result.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Link
                to="/admin/security-activity"
                search={{ ...search, page: Math.max(1, result.page - 1) }}
                aria-disabled={result.page === 1}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  result.page === 1 && "pointer-events-none opacity-50",
                )}
              >
                Previous
              </Link>
            </PaginationItem>
            {paginationItems(result.page, result.totalPages).map((item) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <Link
                    to="/admin/security-activity"
                    search={{ ...search, page: item }}
                    aria-current={item === result.page ? "page" : undefined}
                    className={buttonVariants({
                      variant: item === result.page ? "outline" : "ghost",
                      size: "icon",
                    })}
                  >
                    {item}
                  </Link>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <Link
                to="/admin/security-activity"
                search={{ ...search, page: Math.min(result.totalPages, result.page + 1) }}
                aria-disabled={result.page === result.totalPages}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  result.page === result.totalPages && "pointer-events-none opacity-50",
                )}
              >
                Next
              </Link>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

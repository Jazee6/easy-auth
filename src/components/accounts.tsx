import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";

import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AccountBanState,
  AccountListItem,
  AccountListResult,
  AccountListSearch,
  AccountRoleFilter,
  AccountSortField,
} from "@/lib/admin-accounts";
import { getInitials } from "@/lib/auth-policy";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formattedDate(value: number): string {
  return dateFormatter.format(new Date(value));
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

function SortHeader({
  field,
  label,
  search,
  onSort,
}: {
  field: AccountSortField;
  label: string;
  search: AccountListSearch;
  onSort: (field: AccountSortField) => void;
}) {
  const active = search.sort === field;
  const Icon = active && search.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onSort(field)}>
      {label}
      <Icon className={cn(!active && "opacity-35")} />
    </Button>
  );
}

function roleBadge(role: AccountRoleFilter) {
  return role === "administrator" ? (
    <Badge>Administrator</Badge>
  ) : (
    <Badge variant="secondary">Standard</Badge>
  );
}

function BanStatus({ account }: { account: AccountListItem }) {
  if (account.banState === "none") return <Badge variant="outline">None</Badge>;
  return (
    <div className="min-w-36 space-y-1">
      <Badge variant={account.banState === "active" ? "destructive" : "secondary"}>
        {account.banState === "active" ? "Banned" : "Expired"}
      </Badge>
      {account.banReason && (
        <div className="text-xs text-muted-foreground">{account.banReason}</div>
      )}
      {account.banExpires && (
        <div className="whitespace-nowrap text-xs text-muted-foreground">
          {formattedDate(account.banExpires)}
        </div>
      )}
    </div>
  );
}

export function Accounts({
  result,
  search,
}: {
  result: AccountListResult;
  search: AccountListSearch;
}) {
  const navigate = useNavigate({ from: "/admin/accounts/" });
  const updateSearch = (change: Partial<AccountListSearch>) =>
    navigate({ search: { ...search, ...change, page: change.page ?? 1 } });
  const onSort = (field: AccountSortField) => {
    const direction = search.sort === field && search.direction === "asc" ? "desc" : "asc";
    updateSearch({ sort: field, direction });
  };
  const columns: DataTableColumnDef<AccountListItem>[] = [
    {
      id: "account",
      header: () => <SortHeader field="name" label="Account" search={search} onSort={onSort} />,
      cell: ({ row }) => (
        <div className="flex min-w-44 items-center gap-3">
          <Avatar>
            {row.original.image && <AvatarImage src={row.original.image} alt="" />}
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{row.original.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: () => (
        <SortHeader field="email" label="Login email" search={search} onSort={onSort} />
      ),
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.email}</span>,
    },
    {
      accessorKey: "emailVerified",
      header: "Email",
      cell: ({ row }) => (
        <Badge variant={row.original.emailVerified ? "secondary" : "outline"}>
          {row.original.emailVerified ? "Verified" : "Unverified"}
        </Badge>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => roleBadge(row.original.role),
    },
    {
      accessorKey: "banState",
      header: "Ban",
      cell: ({ row }) => <BanStatus account={row.original} />,
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <SortHeader field="createdAt" label="Created" search={search} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formattedDate(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formattedDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link
          to="/admin/accounts/$accountId"
          params={{ accountId: row.original.accountId }}
          aria-label={`View ${row.original.name}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ChevronRight />
        </Link>
      ),
    },
  ];

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PageHeader
        title="Accounts"
        description={`${result.total} Accounts in this Identity Domain.`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <form
          className="flex min-w-0 flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            updateSearch({ q: typeof value === "string" ? value.trim() : "" });
          }}
        >
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="account-search">Search</FieldLabel>
            <Input
              key={search.q}
              id="account-search"
              name="q"
              type="search"
              defaultValue={search.q}
              placeholder="Name or login email"
            />
          </Field>
          <Button type="submit">
            <Search />
            Search
          </Button>
        </form>

        <Field className="w-full lg:w-auto">
          <FieldLabel id="account-role-label">Role</FieldLabel>
          <Select
            value={search.role ?? "all"}
            onValueChange={(value) =>
              updateSearch({ role: value === "all" ? undefined : (value as AccountRoleFilter) })
            }
          >
            <SelectTrigger className="w-full lg:w-44" aria-labelledby="account-role-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field className="w-full lg:w-auto">
          <FieldLabel id="account-ban-label">Ban state</FieldLabel>
          <Select
            value={search.ban ?? "all"}
            onValueChange={(value) =>
              updateSearch({ ban: value === "all" ? undefined : (value as AccountBanState) })
            }
          >
            <SelectTrigger className="w-full lg:w-44" aria-labelledby="account-ban-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="active">Banned</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="none">Unrestricted</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <DataTable
        data={result.accounts}
        columns={columns}
        emptyMessage="No Accounts found."
        emptyDescription="No Accounts match the current search and filters."
      />

      {result.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Link
                to="/admin/accounts"
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
                    to="/admin/accounts"
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
                to="/admin/accounts"
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

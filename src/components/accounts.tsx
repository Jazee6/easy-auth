import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, Search, X } from "lucide-react";

import {
  BanBadge,
  EmailVerificationBadge,
  RoleBadge,
} from "@/components/account-badges";
import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import { getPaginationItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formattedDate(value: number): string {
  return dateFormatter.format(new Date(value));
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

function BanStatus({ account }: { account: AccountListItem }) {
  if (account.banState === "none") return <BanBadge banState={account.banState} />;
  return (
    <div className="min-w-36 space-y-1">
      <BanBadge banState={account.banState} />
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
  const searching = useRouterState({ select: (state) => state.isLoading });
  const updateSearch = (change: Partial<AccountListSearch>) =>
    navigate({ search: { ...search, ...change, page: change.page ?? 1 } });
  const clearFilters = () =>
    navigate({ search: { q: "", sort: search.sort, direction: search.direction, page: 1 } });
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
        <EmailVerificationBadge emailVerified={row.original.emailVerified} />
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
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
          id="account-search-form"
          className="min-w-0 flex-1"
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

        <Button
          type="submit"
          form="account-search-form"
          disabled={searching}
          className="w-full lg:w-auto"
        >
          {searching ? <Spinner /> : <Search />}
          Search
        </Button>

        {(search.q || search.role || search.ban) && (
          <Button variant="ghost" onClick={clearFilters} className="w-full lg:w-auto">
            <X />
            Clear
          </Button>
        )}
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
            {getPaginationItems(result.page, result.totalPages).map((item) =>
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

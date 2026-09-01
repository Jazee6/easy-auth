export const ACCOUNT_PAGE_SIZE = 20;

export type AccountRoleFilter = "standard" | "administrator";
export type AccountBanState = "active" | "expired" | "none";
export type AccountSortField = "name" | "email" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface AccountListSearch {
  q: string;
  role?: AccountRoleFilter;
  ban?: AccountBanState;
  sort: AccountSortField;
  direction: SortDirection;
  page: number;
}

export interface AccountListItem {
  accountId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: AccountRoleFilter;
  banState: AccountBanState;
  banReason: string | null;
  banExpires: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AccountListResult {
  accounts: AccountListItem[];
  total: number;
  page: number;
  pageSize: typeof ACCOUNT_PAGE_SIZE;
  totalPages: number;
}

interface AccountProjectionRow {
  account_id: string;
  name: string;
  email: string;
  email_verified: number;
  image: string | null;
  account_role: AccountRoleFilter;
  ban_state: AccountBanState;
  ban_reason: string | null;
  ban_expires: number | null;
  created_at: number;
  updated_at: number;
}

const roleFilters = new Set<AccountRoleFilter>(["standard", "administrator"]);
const banStates = new Set<AccountBanState>(["active", "expired", "none"]);
const sortFields = new Set<AccountSortField>(["name", "email", "createdAt"]);
const sortDirections = new Set<SortDirection>(["asc", "desc"]);

function setValue<T extends string>(values: Set<T>, value: unknown): T | undefined {
  return typeof value === "string" && values.has(value as T) ? (value as T) : undefined;
}

export function normalizeAccountListSearch(input: Record<string, unknown>): AccountListSearch {
  const role = setValue(roleFilters, input.role);
  const ban = setValue(banStates, input.ban);
  const sort = setValue(sortFields, input.sort) ?? "createdAt";
  const direction = setValue(sortDirections, input.direction) ?? "desc";
  const page =
    typeof input.page === "number" && Number.isSafeInteger(input.page) && input.page > 0
      ? input.page
      : 1;

  return {
    q: typeof input.q === "string" ? input.q.trim() : "",
    ...(role ? { role } : {}),
    ...(ban ? { ban } : {}),
    sort,
    direction,
    page,
  };
}

const administratorExpression =
  "instr(',' || replace(coalesce(role, ''), ' ', '') || ',', ',admin,') > 0";

function banStateExpression(now: number): string {
  return `CASE
    WHEN banned = 1 AND (ban_expires IS NULL OR ban_expires > ${now}) THEN 'active'
    WHEN banned = 1 AND ban_expires <= ${now} THEN 'expired'
    ELSE 'none'
  END`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function accountProjection(row: AccountProjectionRow): AccountListItem {
  return {
    accountId: row.account_id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified === 1,
    image: row.image,
    role: row.account_role,
    banState: row.ban_state,
    banReason: row.ban_reason,
    banExpires: row.ban_expires,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function accountProjectionColumns(now: number): string {
  return `id AS account_id,
    name,
    email,
    email_verified,
    image,
    CASE WHEN ${administratorExpression} THEN 'administrator' ELSE 'standard' END AS account_role,
    ${banStateExpression(now)} AS ban_state,
    ban_reason,
    ban_expires,
    created_at,
    updated_at`;
}

export async function getIdentityDomainAccount(
  database: D1Database,
  accountId: string,
  now = Date.now(),
): Promise<AccountListItem | null> {
  const row = await database
    .prepare(`SELECT ${accountProjectionColumns(now)} FROM user WHERE id = ?`)
    .bind(accountId)
    .first<AccountProjectionRow>();
  return row ? accountProjection(row) : null;
}

export async function listIdentityDomainAccounts(
  database: D1Database,
  search: AccountListSearch,
  now = Date.now(),
): Promise<AccountListResult> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  const banState = banStateExpression(now);

  if (search.q) {
    const term = `%${escapeLike(search.q.toLowerCase())}%`;
    conditions.push("(lower(name) LIKE ? ESCAPE '\\' OR lower(email) LIKE ? ESCAPE '\\')");
    bindings.push(term, term);
  }

  if (search.role === "administrator") conditions.push(administratorExpression);
  if (search.role === "standard") conditions.push(`NOT (${administratorExpression})`);
  if (search.ban) {
    conditions.push(`(${banState}) = ?`);
    bindings.push(search.ban);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await database
    .prepare(`SELECT count(*) AS total FROM user ${where}`)
    .bind(...bindings)
    .first<number>("total");
  const total = count ?? 0;
  const totalPages = Math.ceil(total / ACCOUNT_PAGE_SIZE);
  const page = Math.min(search.page, Math.max(totalPages, 1));

  const sortColumn =
    search.sort === "name"
      ? "lower(name)"
      : search.sort === "email"
        ? "lower(email)"
        : "created_at";
  const direction = search.direction === "asc" ? "ASC" : "DESC";
  const query = database
    .prepare(
      `SELECT ${accountProjectionColumns(now)}
      FROM user
      ${where}
      ORDER BY ${sortColumn} ${direction}, id ASC
      LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, ACCOUNT_PAGE_SIZE, (page - 1) * ACCOUNT_PAGE_SIZE);
  const rows = await query.all<AccountProjectionRow>();

  return {
    accounts: rows.results.map(accountProjection),
    total,
    page,
    pageSize: ACCOUNT_PAGE_SIZE,
    totalPages,
  };
}

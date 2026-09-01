import { describe, expect, test } from "bun:test";

import { normalizeAccountListSearch } from "./admin-accounts";

describe("Account list search state", () => {
  test("normalizes URL search input to documented defaults", () => {
    expect(normalizeAccountListSearch({})).toEqual({
      q: "",
      sort: "createdAt",
      direction: "desc",
      page: 1,
    });
    expect(
      normalizeAccountListSearch({
        q: "  Alice@Example.com  ",
        role: "administrator",
        ban: "expired",
        sort: "email",
        direction: "asc",
        page: 3,
      }),
    ).toEqual({
      q: "Alice@Example.com",
      role: "administrator",
      ban: "expired",
      sort: "email",
      direction: "asc",
      page: 3,
    });
  });

  test("falls back safely for invalid filters, sorting, and pages", () => {
    expect(
      normalizeAccountListSearch({
        role: "owner",
        ban: "banned",
        sort: "updatedAt",
        direction: "sideways",
        page: -4,
      }),
    ).toEqual({
      q: "",
      sort: "createdAt",
      direction: "desc",
      page: 1,
    });
  });
});

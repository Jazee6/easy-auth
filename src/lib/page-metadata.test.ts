import { describe, expect, test } from "bun:test";

import { privatePageHead, publicPageHead } from "./page-metadata";

describe("page metadata", () => {
  test("indexes only an explicitly public page and emits its canonical link", () => {
    expect(publicPageHead("Sign in", "/login")).toEqual({
      meta: [{ title: "Sign in | Easy Auth" }, { name: "robots", content: "index, follow" }],
      links: [{ rel: "canonical", href: "/login" }],
    });
  });

  test("lets private pages inherit the root noindex policy", () => {
    expect(privatePageHead("Security")).toEqual({
      meta: [{ title: "Security | Easy Auth" }],
    });
  });
});

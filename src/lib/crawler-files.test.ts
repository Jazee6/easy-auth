import { describe, expect, test } from "bun:test";

import { buildRobotsTxt, buildSitemap, getSitemapPaths } from "./crawler-files";

describe("crawler files", () => {
  test("lists landing pages only on the official deployment", () => {
    expect(getSitemapPaths("https://account.jaze.top")).toEqual([
      "/",
      "/zh",
      "/login",
      "/signup",
      "/privacy",
      "/terms",
    ]);
    expect(getSitemapPaths("https://auth.example.com/")).toEqual([
      "/login",
      "/signup",
      "/privacy",
      "/terms",
    ]);
  });

  test("emits absolute URLs for the instance origin", () => {
    expect(buildSitemap("https://auth.example.com")).toContain(
      "<loc>https://auth.example.com/login</loc>",
    );
    expect(buildRobotsTxt("https://auth.example.com")).toContain(
      "Sitemap: https://auth.example.com/sitemap.xml",
    );
  });

  test("keeps noindex pages crawlable and only blocks the API", () => {
    const robots = buildRobotsTxt("https://auth.example.com");
    expect(robots).toContain("Disallow: /api/");
    expect(robots.match(/Disallow/g)?.length).toBe(1);
  });
});

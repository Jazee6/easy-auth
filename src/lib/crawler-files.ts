import { OFFICIAL_SITE_URL, landingPaths } from "./landing-content";

/** Pages that opt into indexing through publicPageHead or landingPageHead. */
const indexablePaths = ["/login", "/signup", "/privacy", "/terms"] as const;

function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

/**
 * Landing pages declare the official site as canonical, so only the official
 * deployment lists them; other instances would otherwise advertise URLs whose
 * canonical points elsewhere.
 */
export function getSitemapPaths(baseUrl: string): string[] {
  const landing =
    originOf(baseUrl) === originOf(OFFICIAL_SITE_URL) ? Object.values(landingPaths) : [];
  return [...landing, ...indexablePaths];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSitemap(baseUrl: string): string {
  const origin = originOf(baseUrl);
  const urls = getSitemapPaths(baseUrl)
    .map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Pages marked noindex stay crawlable so crawlers can read that directive;
 * only the API surface is excluded.
 */
export function buildRobotsTxt(baseUrl: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${new URL("/sitemap.xml", originOf(baseUrl)).href}\n`;
}

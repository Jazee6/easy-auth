import { describe, expect, test } from "bun:test";

import {
  buildLandingJsonLd,
  getLandingLocale,
  landingContent,
  landingPageHead,
  serializeJsonLd,
} from "./landing-content";

describe("landing page metadata", () => {
  test("points canonical and hreflang links at the official site for every instance", () => {
    expect(landingPageHead("zh").links).toEqual([
      { rel: "canonical", href: "https://account.jaze.top/zh" },
      { rel: "alternate", hrefLang: "en", href: "https://account.jaze.top/" },
      { rel: "alternate", hrefLang: "zh-CN", href: "https://account.jaze.top/zh" },
      { rel: "alternate", hrefLang: "x-default", href: "https://account.jaze.top/" },
    ]);
  });

  test("overrides the root noindex policy and uses absolute social URLs", () => {
    const meta = landingPageHead("en").meta;
    const find = (key: string) =>
      meta.find((tag) => tag.name === key || tag.property === key)?.content;
    expect(find("robots")).toBe("index, follow");
    expect(find("og:url")).toBe("https://account.jaze.top/");
    expect(find("og:image")).toBe("https://account.jaze.top/og-image.png");
  });

  test("publishes the visible FAQ as FAQPage structured data", () => {
    const graph = buildLandingJsonLd("en")["@graph"];
    const faq = graph.find((node) => node["@type"] === "FAQPage") as {
      mainEntity: { name: string }[];
    };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(
      landingContent.en.faq.items.map((item) => item.question),
    );
  });

  test("keeps JSON-LD from closing its script element", () => {
    expect(serializeJsonLd({ text: "</script><script>" }).includes("<")).toBe(false);
  });

  test("resolves the locale from the pathname", () => {
    expect(getLandingLocale("/")).toBe("en");
    expect(getLandingLocale("/zh")).toBe("zh");
    expect(getLandingLocale("/login")).toBeNull();
  });
});

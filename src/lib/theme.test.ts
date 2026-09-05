import { describe, expect, it } from "bun:test";

import {
  THEME_STORAGE_KEY,
  isTheme,
  readStoredTheme,
  resolveTheme,
  themeBootstrapScript,
  writeStoredTheme,
} from "./theme";

describe("theme policy", () => {
  it("accepts only supported theme preferences", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("reads valid preferences and falls back to system", () => {
    expect(readStoredTheme({ getItem: () => "dark" })).toBe("dark");
    expect(readStoredTheme({ getItem: () => "invalid" })).toBe("system");
    expect(
      readStoredTheme({
        getItem() {
          throw new Error("storage unavailable");
        },
      }),
    ).toBe("system");
  });

  it("stores preferences without surfacing unavailable storage", () => {
    const values = new Map<string, string>();
    writeStoredTheme({ setItem: (key, value) => values.set(key, value) }, "light");
    expect(values.get(THEME_STORAGE_KEY)).toBe("light");
    writeStoredTheme(
      {
        setItem() {
          throw new Error("storage unavailable");
        },
      },
      "dark",
    );
  });

  it("resolves system preference without overriding explicit choices", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("bootstraps the stored preference before rendering", () => {
    expect(themeBootstrapScript).toContain(THEME_STORAGE_KEY);
    expect(themeBootstrapScript).toContain("prefers-color-scheme: dark");
    expect(themeBootstrapScript).toContain('classList.toggle("dark"');
  });
});

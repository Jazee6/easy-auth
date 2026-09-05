export const THEME_STORAGE_KEY = "easy-auth.theme";

export const themes = ["light", "dark", "system"] as const;
export type Theme = (typeof themes)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export function isTheme(value: unknown): value is Theme {
  return themes.includes(value as Theme);
}

export function readStoredTheme(storage: Pick<Storage, "getItem">): Theme {
  try {
    const storedTheme = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : "system";
  } catch {
    return "system";
  }
}

export function writeStoredTheme(storage: Pick<Storage, "setItem">, theme: Theme): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

export function applyTheme(theme: Theme, prefersDark: boolean): void {
  const resolvedTheme = resolveTheme(theme, prefersDark);
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.style.colorScheme = resolvedTheme;
}

export const themeBootstrapScript = `(()=>{try{const t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});const d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch{}})();`;

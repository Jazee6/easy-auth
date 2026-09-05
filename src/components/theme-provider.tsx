import * as React from "react";

import { applyTheme, readStoredTheme, writeStoredTheme, type Theme } from "@/lib/theme";

const systemThemeQuery = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    const media = window.matchMedia(systemThemeQuery);
    let selectedTheme = theme;

    if (!isMounted.current) {
      isMounted.current = true;
      selectedTheme = readStoredTheme(window.localStorage);
      if (selectedTheme !== theme) setThemeState(selectedTheme);
    }

    const syncTheme = () => applyTheme(selectedTheme, media.matches);
    syncTheme();

    if (selectedTheme !== "system") return;
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    writeStoredTheme(window.localStorage, nextTheme);
    applyTheme(nextTheme, window.matchMedia(systemThemeQuery).matches);
    setThemeState(nextTheme);
  };

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = React.use(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

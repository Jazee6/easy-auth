import { Link } from "@tanstack/react-router";

import { ThemeSwitcher } from "@/components/theme-switcher";

interface LegalDocumentLayoutProps {
  children: React.ReactNode;
}

export function LegalDocumentLayout({ children }: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="font-semibold tracking-tight">
            Easy Auth
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <article className="typeset typeset-docs">{children}</article>
      </main>

      <footer className="border-t">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-3xl items-center gap-5 px-6 py-6 text-sm text-muted-foreground"
        >
          <Link to="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
      </footer>
    </div>
  );
}

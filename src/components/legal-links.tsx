import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface LegalLinksProps {
  agreement?: boolean;
  className?: string;
}

export function LegalLinks({ agreement = false, className }: LegalLinksProps) {
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      {agreement && "By creating an account, you agree to the "}
      <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
        Terms of Service
      </Link>
      {agreement ? " and acknowledge the " : " · "}
      <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
        Privacy Policy
      </Link>
      {agreement && "."}
    </p>
  );
}

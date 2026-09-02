import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 2000);
      toast.add({ title: `${label} copied`, type: "success" });
    } catch {
      toast.add({
        title: `Unable to copy ${label}`,
        description: "Copy the value manually and try again if needed.",
        type: "error",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? <Check className="animate-in fade-in-0 zoom-in-75 text-primary" /> : <Copy />}
    </Button>
  );
}

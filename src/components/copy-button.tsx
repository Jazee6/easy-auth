import { useEffect, useRef, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { Check, Copy } from "lucide-react";

import { Button, type buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  value: string;
  label: string;
  children?: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function CopyButton({ value, label, children, variant, size, className }: CopyButtonProps) {
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

  const resolvedVariant = variant ?? (children ? "outline" : "ghost");
  const resolvedSize = size ?? (children ? "default" : "icon-xs");

  return (
    <Button
      type="button"
      variant={resolvedVariant}
      size={resolvedSize}
      className={cn(
        "shrink-0",
        !children && resolvedVariant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : children ? undefined : `Copy ${label}`}
    >
      {copied ? <Check className="animate-in fade-in-0 zoom-in-75 text-primary" /> : <Copy />}
      {children}
    </Button>
  );
}

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const CopyButton = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="icon" variant="outline" onClick={onCopy} className="relative">
      <Copy
        className={cn(
          "absolute size-4 transition-all",
          copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Check
        className={cn(
          "absolute size-4 transition-all",
          copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </Button>
  );
};

export default CopyButton;

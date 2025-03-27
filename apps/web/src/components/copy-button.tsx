import { Button } from "@/components/ui/button.tsx";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <Button className="ml-2" variant="outline" size="icon" onClick={handleCopy}>
      {copied ? (
        <Check className="animate-in zoom-in" />
      ) : (
        <Copy className="animate-in zoom-in" />
      )}
    </Button>
  );
};

export default CopyButton;

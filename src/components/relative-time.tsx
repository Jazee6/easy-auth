import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/oauth-activity";

export function RelativeTime({ value }: { value: Date | number | string }) {
  const absolute = formatAbsoluteTime(value);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className="cursor-help underline decoration-dotted underline-offset-4"
            />
          }
        >
          {formatRelativeTime(value)}
        </TooltipTrigger>
        <TooltipContent>{absolute}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

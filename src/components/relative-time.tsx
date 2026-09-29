import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/oauth-activity";

export function RelativeTime({ value }: { value: Date | number | string }) {
  // Relative and zoned text depends on the viewer's clock, so fill it in after hydration.
  const hydrated = useHydrated();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <time
              dateTime={new Date(value).toISOString()}
              tabIndex={0}
              className="cursor-help underline decoration-dotted underline-offset-4"
            />
          }
        >
          {hydrated ? formatRelativeTime(value) : null}
        </TooltipTrigger>
        <TooltipContent>{hydrated ? formatAbsoluteTime(value) : null}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

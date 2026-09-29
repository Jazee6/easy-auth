import { useHydrated } from "@/hooks/use-hydrated";

const formatters = {
  date: new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }),
  medium: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }),
  long: new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }),
};

export type LocalDateTimeStyle = keyof typeof formatters;

/**
 * Renders a timestamp in the viewer's time zone. The server cannot know that
 * zone, so the text is filled in after hydration to avoid a mismatch.
 */
export function LocalDateTime({
  value,
  format = "medium",
}: {
  value: Date | number | string;
  format?: LocalDateTimeStyle;
}) {
  const hydrated = useHydrated();
  const date = new Date(value);
  return (
    <time dateTime={date.toISOString()}>{hydrated ? formatters[format].format(date) : null}</time>
  );
}

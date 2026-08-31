export type OAuthClientAuditAction =
  | "create"
  | "update"
  | "disable"
  | "enable"
  | "rotate-secret"
  | "delete";

export interface OAuthClientActivityRecord {
  id: string;
  clientId: string;
  clientName: string;
  action: OAuthClientAuditAction | string;
  summary: string;
  createdAt: Date | number | string;
}

export type OAuthClientActivityIcon =
  | "registered"
  | "updated"
  | "disabled"
  | "enabled"
  | "rotated"
  | "deleted";

export interface OAuthClientActivityEvent {
  title: string;
  summary: string;
  icon: OAuthClientActivityIcon;
}

function parseSummary(summary: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(summary);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function formatChangedFields(summary: string): string {
  const parsed = parseSummary(summary);
  const changed = Array.isArray(parsed.changed)
    ? parsed.changed.filter((value): value is string => typeof value === "string")
    : [];
  const labels = changed.flatMap((field) => {
    if (field === "name") return ["application name"];
    if (field === "redirectUris") return ["redirect URIs"];
    return [];
  });

  if (labels.length === 0) return "Updated the client configuration.";
  if (labels.length === 1) return `Changed ${labels[0]}.`;
  return `Changed ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}.`;
}

function formatRegistration(summary: string): string {
  const parsed = parseSummary(summary);
  const applicationType = parsed.applicationType;
  const authentication = parsed.authentication;
  if (typeof applicationType !== "string" || typeof authentication !== "string") {
    return "Registered a new OAuth client.";
  }
  return `Registered as ${titleCase(applicationType)} · ${titleCase(authentication)}.`;
}

export function formatOAuthClientActivityEvent(
  record: Pick<OAuthClientActivityRecord, "action" | "summary">,
): OAuthClientActivityEvent {
  switch (record.action) {
    case "create":
      return {
        title: "Client registered",
        summary: formatRegistration(record.summary),
        icon: "registered",
      };
    case "update":
      return {
        title: "Configuration updated",
        summary: formatChangedFields(record.summary),
        icon: "updated",
      };
    case "disable":
      return {
        title: "Client disabled",
        summary:
          "New authorization, token exchange, refresh, client authentication, and existing access token use are blocked immediately. Application authorizations remain.",
        icon: "disabled",
      };
    case "enable":
      return {
        title: "Client enabled",
        summary:
          "New authorization, token exchange, refresh, and client authentication are available again. Existing unexpired tokens can be used again.",
        icon: "enabled",
      };
    case "rotate-secret":
      return {
        title: "Client secret rotated",
        summary: "The previous secret stopped working immediately.",
        icon: "rotated",
      };
    case "delete":
      return {
        title: "Client deleted",
        summary: "Client and dependent authorization state were removed.",
        icon: "deleted",
      };
    default:
      return {
        title: "Client activity",
        summary: "A management activity was recorded for this client.",
        icon: "updated",
      };
  }
}

const relativeTimeUnits = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
] as const;

function toTimestamp(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function formatRelativeTime(value: Date | number | string, now = Date.now()): string {
  const difference = toTimestamp(value) - now;
  if (!Number.isFinite(difference) || Math.abs(difference) < 1_000) return "just now";

  const [unit, milliseconds] = relativeTimeUnits.find(
    ([, size]) => Math.abs(difference) >= size,
  ) ?? ["second", 1_000];
  const amount = Math.round(difference / milliseconds);
  return new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(
    amount,
    unit as Intl.RelativeTimeFormatUnit,
  );
}

export function formatAbsoluteTime(value: Date | number | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(toTimestamp(value)));
}

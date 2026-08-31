import { describe, expect, test } from "bun:test";

import {
  formatAbsoluteTime,
  formatOAuthClientActivityEvent,
  formatRelativeTime,
} from "./oauth-activity";

describe("OAuth client activity formatter", () => {
  test("maps every persisted action to a user-facing event without raw data", () => {
    const records = [
      ["create", '{"applicationType":"web","authentication":"confidential"}', "Client registered"],
      ["update", '{"changed":["name","redirectUris"]}', "Configuration updated"],
      ["disable", '{"disabled":true}', "Client disabled"],
      ["enable", '{"disabled":false}', "Client enabled"],
      ["rotate-secret", '{"changed":[]}', "Client secret rotated"],
      ["delete", '{"deleted":true}', "Client deleted"],
    ] as const;

    for (const [action, summary, title] of records) {
      const event = formatOAuthClientActivityEvent({ action, summary });
      expect(event.title).toBe(title);
      expect(event.summary.includes(summary)).toBe(false);
      expect(event.summary.includes(action)).toBe(false);
      expect(event.summary.includes("{")).toBe(false);
    }
  });

  test("describes provider-native disable and re-enable behavior", () => {
    expect(
      formatOAuthClientActivityEvent({ action: "disable", summary: '{"disabled":true}' }).summary,
    ).toContain("blocked immediately");
    expect(
      formatOAuthClientActivityEvent({ action: "enable", summary: '{"disabled":false}' }).summary,
    ).toContain("Existing unexpired tokens can be used again");
  });

  test("describes configuration changes without exposing audit JSON", () => {
    const changed = formatOAuthClientActivityEvent({
      action: "update",
      summary: '{"changed":["name","redirectUris"]}',
    });
    expect(changed.title).toBe("Configuration updated");
    expect(changed.summary).toBe("Changed application name and redirect URIs.");
    expect(
      formatOAuthClientActivityEvent({ action: "update", summary: '{"changed":["unknown"]}' })
        .summary,
    ).toBe("Updated the client configuration.");
  });

  test("uses relative time and a local absolute tooltip value", () => {
    const now = Date.UTC(2026, 7, 31, 12, 0, 0);
    expect(formatRelativeTime(now - 2 * 60 * 60 * 1000, now)).toBe("2 hours ago");
    expect(formatRelativeTime(now + 5 * 60 * 1000, now)).toBe("in 5 minutes");
    expect(formatRelativeTime(now, now)).toBe("just now");
    expect(formatAbsoluteTime(now)).toContain("2026");
  });
});

import { describe, expect, test } from "bun:test";
import * as v from "valibot";

import {
  BAN_DURATIONS,
  BAN_REASON_PRESETS,
  banAccountInputSchema,
  formatBanDuration,
  getBanDurationFromSeconds,
  getBanDurationSeconds,
  translateBanAccountError,
  translateUnbanAccountError,
} from "./admin-security";

describe("Account Ban policy", () => {
  test("accepts trimmed preset or bounded custom reasons with fixed durations", () => {
    for (const reason of BAN_REASON_PRESETS) {
      expect(
        v.parse(banAccountInputSchema, {
          accountId: " account-1 ",
          reason: ` ${reason} `,
          duration: "24-hours",
        }),
      ).toEqual({ accountId: "account-1", reason, duration: "24-hours" });
    }

    expect(
      v.parse(banAccountInputSchema, {
        accountId: "account-1",
        reason: "x".repeat(500),
        duration: "permanent",
      }).reason.length,
    ).toBe(500);
  });

  test("rejects blank, overlong, and unsupported Ban input", () => {
    for (const input of [
      { accountId: "account-1", reason: "   ", duration: "24-hours" },
      { accountId: "account-1", reason: "x".repeat(501), duration: "24-hours" },
      { accountId: "account-1", reason: "Abuse", duration: "two-hours" },
    ]) {
      expect(v.safeParse(banAccountInputSchema, input).success).toBe(false);
    }
  });

  test("maps only the five requested durations to Better Auth seconds", () => {
    const expectations = [
      ["one-hour", 3_600, "1 hour"],
      ["24-hours", 86_400, "24 hours"],
      ["seven-days", 604_800, "7 days"],
      ["30-days", 2_592_000, "30 days"],
      ["permanent", undefined, "Permanent"],
    ] as const;

    expect(BAN_DURATIONS.length).toBe(5);
    for (const [duration, seconds, label] of expectations) {
      expect(getBanDurationSeconds(duration)).toBe(seconds);
      expect(getBanDurationFromSeconds(seconds)).toBe(duration);
      expect(formatBanDuration(duration)).toBe(label);
    }
    expect(getBanDurationFromSeconds(7_200)).toBeNull();
    expect(getBanDurationFromSeconds(0)).toBeNull();
  });

  test("translates stable Ban failures without exposing raw server details", () => {
    expect(translateBanAccountError({ code: "SECURITY_ACTION_INVALID_STATE" })).toContain(
      "already banned",
    );
    expect(translateBanAccountError({ code: "SECURITY_CLEANUP_FAILED" })).toContain(
      "cleanup is incomplete",
    );
    expect(translateBanAccountError(new Error("database token abc-secret"))).toBe(
      "Unable to Ban this Account. Refresh its security state and try again.",
    );
    expect(translateUnbanAccountError({ code: "SECURITY_CLEANUP_INCOMPLETE" })).toContain(
      "cleanup is incomplete",
    );
    expect(translateUnbanAccountError({ code: "SECURITY_ACTION_INVALID_STATE" })).toContain(
      "already unrestricted",
    );
  });
});

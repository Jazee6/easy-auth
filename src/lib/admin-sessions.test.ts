import { describe, expect, test } from "bun:test";

import {
  describeSessionDevice,
  orderSelfServiceAccountSessions,
  type SafeAccountSession,
} from "./admin-sessions";

const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

describe("Session device description", () => {
  test("describes known desktop and mobile User-Agents", () => {
    expect(describeSessionDevice(WINDOWS_CHROME)).toEqual({
      browser: "Chrome 131.0.0.0",
      operatingSystem: "Windows 10",
      deviceType: "Desktop",
    });
    expect(describeSessionDevice(IPHONE_SAFARI)).toEqual({
      browser: "Safari 18.1",
      operatingSystem: "iOS 18.1",
      deviceType: "Mobile",
    });
  });

  test("uses safe fallbacks for missing and unrecognized User-Agents", () => {
    const fallback = {
      browser: "Unknown browser",
      operatingSystem: "Unknown operating system",
      deviceType: "Unknown device",
    };
    expect(describeSessionDevice(null)).toEqual(fallback);
    expect(describeSessionDevice("custom-client/1.0")).toEqual(fallback);
  });
});

describe("Account-owned Session ordering", () => {
  test("places the current Session first and uses update time then ID for a stable order", () => {
    const session = (
      sessionId: string,
      updatedAt: number,
      createdAt = updatedAt,
    ): SafeAccountSession => ({
      sessionId,
      browser: "Unknown browser",
      operatingSystem: "Unknown operating system",
      deviceType: "Unknown device",
      ipAddress: "Unknown",
      createdAt,
      updatedAt,
      expiresAt: updatedAt + 10_000,
    });

    expect(
      orderSelfServiceAccountSessions(
        [
          session("same-b", 300),
          session("current", 100),
          session("older", 200),
          session("same-a", 300),
        ],
        "current",
      ).map(({ sessionId, isCurrent }) => ({ sessionId, isCurrent })),
    ).toEqual([
      { sessionId: "current", isCurrent: true },
      { sessionId: "same-a", isCurrent: false },
      { sessionId: "same-b", isCurrent: false },
      { sessionId: "older", isCurrent: false },
    ]);
  });

  test("marks no Session current when the authoritative ID is absent", () => {
    const sessions: SafeAccountSession[] = [
      {
        sessionId: "only",
        browser: "Unknown browser",
        operatingSystem: "Unknown operating system",
        deviceType: "Unknown device",
        ipAddress: "Unknown",
        createdAt: 100,
        updatedAt: 100,
        expiresAt: 200,
      },
    ];

    expect(orderSelfServiceAccountSessions(sessions, "missing")[0]?.isCurrent).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";

import { describeSessionDevice } from "./admin-sessions";

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

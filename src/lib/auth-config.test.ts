import { describe, expect, test } from "bun:test";

import {
  assertProductionAuthEnvironment,
  requiredProductionAuthEnvironment,
  type AuthEnvironment,
} from "./auth-factory";
import { getProfileWriteError, isRateLimitedAuthRequest } from "./auth-policy";

function completeEnvironment(): AuthEnvironment {
  const environment: AuthEnvironment = { DB: {} as D1Database };
  for (const key of requiredProductionAuthEnvironment) environment[key] = `${key}-value`;
  return environment;
}

describe("Production auth configuration", () => {
  test("accepts a complete environment", () => {
    assertProductionAuthEnvironment(completeEnvironment());
  });

  test("names every missing or blank value", () => {
    const environment = completeEnvironment();
    delete environment.TURNSTILE_SECRET_KEY;
    environment.GOOGLE_CLIENT_SECRET = " ";
    expect(() => assertProductionAuthEnvironment(environment)).toThrow(
      "Missing required Easy Auth configuration: TURNSTILE_SECRET_KEY, GOOGLE_CLIENT_SECRET",
    );
  });
});

describe("Profile write policy", () => {
  test("requires a bounded name and forbids images at sign-up", () => {
    expect(getProfileWriteError("/sign-up/email", { name: "derived-name" })).toBeNull();
    expect(getProfileWriteError("/sign-up/email", { name: "a".repeat(64) })).toBeNull();
    expect(getProfileWriteError("/sign-up/email", {})).toBe("Name is required");
    expect(getProfileWriteError("/sign-up/email", { name: "a".repeat(101) })).toBe(
      "Name must be at most 100 characters",
    );
    expect(
      getProfileWriteError("/sign-up/email", { name: "n", image: "https://example.com/a.png" }),
    ).toBe("Avatar cannot be set during sign-up");
  });

  test("validates only the fields an update sends", () => {
    expect(getProfileWriteError("/update-user", {})).toBeNull();
    expect(getProfileWriteError("/update-user", { image: null })).toBeNull();
    expect(getProfileWriteError("/update-user", { image: "" })).toBeNull();
    expect(getProfileWriteError("/update-user", { image: "https://example.com/a.png" })).toBeNull();
    expect(getProfileWriteError("/update-user", { image: "http://example.com/a.png" })).toBe(
      "Avatar must be a valid HTTPS URL",
    );
    expect(getProfileWriteError("/update-user", { name: "" })).toBe("Name is required");
    expect(getProfileWriteError("/change-password", { name: "" })).toBeNull();
  });

  test("rejects whitespace padding that would bypass the length limits", () => {
    expect(getProfileWriteError("/update-user", { name: `a${" ".repeat(20_000)}` })).toBe(
      "Name must not start or end with whitespace",
    );
    expect(getProfileWriteError("/sign-up/email", { name: " name" })).toBe(
      "Name must not start or end with whitespace",
    );
    expect(
      getProfileWriteError("/update-user", {
        image: `https://example.com/a.png${" ".repeat(20_000)}`,
      }),
    ).toBe("Avatar URL must not start or end with whitespace");
  });
});

describe("Database rate-limit scope", () => {
  test("limits state-changing methods only", () => {
    expect(["GET", "head", "OPTIONS"].map(isRateLimitedAuthRequest)).toEqual([false, false, false]);
    expect(["POST", "PATCH", "DELETE"].map(isRateLimitedAuthRequest)).toEqual([true, true, true]);
  });
});

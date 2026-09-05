import { describe, expect, test } from "bun:test";
import {
  consumePasskeyRegistrationDraft,
  savePasskeyRegistrationDraft,
} from "./passkey-registration-draft";
import { getGithubSignInOptions } from "./auth-policy";
import { sanitizeReturnDestination } from "./passkey-policy";

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("passkey registration resume", () => {
  test("restores the name once for the original account", () => {
    const storage = createStorage();
    savePasskeyRegistrationDraft(storage, "user-1", "Work laptop", 1000);
    expect(consumePasskeyRegistrationDraft(storage, "user-1", 2000)).toBe("Work laptop");
    expect(consumePasskeyRegistrationDraft(storage, "user-1", 2000)).toBeNull();
  });

  test("preserves an optional empty name", () => {
    const storage = createStorage();
    savePasskeyRegistrationDraft(storage, "user-1", "", 1000);
    expect(consumePasskeyRegistrationDraft(storage, "user-1", 2000)).toBe("");
  });

  test("discards drafts after account switching", () => {
    const storage = createStorage();
    savePasskeyRegistrationDraft(storage, "user-1", "Private name", 1000);
    expect(consumePasskeyRegistrationDraft(storage, "user-2", 2000)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  test("discards expired and future-dated drafts", () => {
    const storage = createStorage();
    for (const now of [1000 + 15 * 60 * 1000 + 1, 999]) {
      savePasskeyRegistrationDraft(storage, "user-1", "Laptop", 1000);
      expect(consumePasskeyRegistrationDraft(storage, "user-1", now)).toBeNull();
      expect(storage.values.size).toBe(0);
    }
  });

  test("discards malformed or invalid drafts", () => {
    const storage = createStorage();
    for (const raw of [
      "invalid",
      "null",
      "{}",
      JSON.stringify({
        userId: "user-1",
        name: "x".repeat(65),
        createdAt: 1000,
      }),
    ]) {
      savePasskeyRegistrationDraft(storage, "user-1", "Laptop", 1000);
      for (const key of storage.values.keys()) storage.setItem(key, raw);
      expect(consumePasskeyRegistrationDraft(storage, "user-1", 2000)).toBeNull();
      expect(storage.values.size).toBe(0);
    }
  });

  test("retains the resume marker through login return destinations", () => {
    const returnTo = "/sign-in-methods?resume=add-passkey";
    expect(sanitizeReturnDestination(returnTo)).toBe(returnTo);
    const options = getGithubSignInOptions({ returnTo });
    expect(options.callbackURL).toBe(returnTo);
    expect(options.newUserCallbackURL).toBe(returnTo);
    expect(
      new URL(options.errorCallbackURL, "https://example.com").searchParams.get("returnTo"),
    ).toBe(returnTo);
    expect(sanitizeReturnDestination(`${returnTo}&next=https://evil.com`)).toBe("/profile");
  });
});

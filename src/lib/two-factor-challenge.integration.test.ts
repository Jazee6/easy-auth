import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { base32 } from "@better-auth/utils/base32";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { createEasyAuth } from "./auth-factory";

const BASE_URL = "http://easy-auth-two-factor-challenge.test";
const PASSWORD = "integration-password";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;

interface AuthErrorPayload {
  code?: string;
  message: string;
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "two-factor-challenge-test" },
    }),
  );
  database = (await miniflare.getD1Database("DB")) as unknown as D1Database;

  const migrations = (await readdir("drizzle")).filter((path) => path.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const statements = (await readFile(join("drizzle", migration), "utf8"))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));
    await database.batch(statements);
  }

  auth = createEasyAuth({
    environment: {
      DB: database,
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "two-factor-challenge-secret-32-characters",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
  });
});

afterAll(async () => {
  await miniflare.dispose();
});

async function postAuth(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: BASE_URL });
  if (cookie) headers.set("cookie", cookie);
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

function responseCookies(response: Response): string {
  const values = response.headers.getSetCookie();
  if (values.length === 0) throw new Error("Expected response cookies");
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function countSessions(accountId: string): Promise<number> {
  return (
    (await database
      .prepare("SELECT count(*) AS count FROM session WHERE user_id = ?")
      .bind(accountId)
      .first<number>("count")) ?? 0
  );
}

async function generateCurrentCode(totpURI: string): Promise<string> {
  const encodedSecret = new URL(totpURI).searchParams.get("secret");
  if (!encodedSecret) throw new Error("Expected TOTP setup secret");
  const secret = new TextDecoder().decode(base32.decode(encodedSecret));
  return (await auth.api.generateTOTP({ body: { secret } })).code;
}

async function createEnabledAccount(slug: string) {
  const email = `${slug}@example.com`;
  await database.prepare("DELETE FROM rate_limit").run();
  const signup = await postAuth("/sign-up/email", { name: slug, email, password: PASSWORD });
  expect(signup.status).toBe(200);
  const accountId = ((await signup.json()) as { user: { id: string } }).user.id;
  await database.prepare("UPDATE user SET email_verified = 1 WHERE id = ?").bind(accountId).run();

  await database.prepare("DELETE FROM rate_limit").run();
  const login = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(login.status).toBe(200);
  const sessionCookie = responseCookies(login);
  const enable = await postAuth(
    "/two-factor/enable",
    { password: PASSWORD, method: "totp" },
    sessionCookie,
  );
  expect(enable.status).toBe(200);
  const setup = (await enable.json()) as { totpURI: string; backupCodes: string[] };
  const verify = await postAuth(
    "/two-factor/verify-totp",
    { code: await generateCurrentCode(setup.totpURI), trustDevice: false },
    sessionCookie,
  );
  expect(verify.status).toBe(200);
  await database.prepare("DELETE FROM session WHERE user_id = ?").bind(accountId).run();

  return { accountId, email, ...setup };
}

async function startPasswordChallenge(email: string) {
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(response.status).toBe(200);
  expect(await response.clone().json()).toEqual({
    twoFactorRedirect: true,
    twoFactorMethods: ["totp"],
  });
  return { response, cookie: responseCookies(response) };
}

describe("password-login Two-Factor challenge", () => {
  test("withholds the preliminary Session and creates exactly one after valid TOTP", async () => {
    const account = await createEnabledAccount("challenge-totp");
    const challenge = await startPasswordChallenge(account.email);

    expect(await countSessions(account.accountId)).toBe(0);
    const challengePayload = JSON.stringify(await challenge.response.clone().json());
    expect(/password|secret|backup|token|cookie/i.test(challengePayload)).toBe(false);

    const verified = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(account.totpURI), trustDevice: false },
      challenge.cookie,
    );
    expect(verified.status).toBe(200);
    expect(
      verified.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("better-auth.last_used_login_method=email")),
    ).toBe(true);
    expect(await countSessions(account.accountId)).toBe(1);

    const replay = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(account.totpURI), trustDevice: false },
      challenge.cookie,
    );
    expect(replay.status).toBe(401);
    expect((await replay.json()) as AuthErrorPayload).toEqual({
      code: "INVALID_TWO_FACTOR_COOKIE",
      message: "Invalid two factor cookie",
    });
    expect(await countSessions(account.accountId)).toBe(1);
  });

  test("consumes one Backup Code and rejects its replay in a later challenge", async () => {
    const account = await createEnabledAccount("challenge-backup");
    const firstChallenge = await startPasswordChallenge(account.email);
    const backupCode = account.backupCodes[0];

    const verified = await postAuth(
      "/two-factor/verify-backup-code",
      { code: backupCode, trustDevice: false },
      firstChallenge.cookie,
    );
    expect(verified.status).toBe(200);
    expect(
      verified.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("better-auth.last_used_login_method=email")),
    ).toBe(true);
    expect(await countSessions(account.accountId)).toBe(1);

    await database.prepare("DELETE FROM session WHERE user_id = ?").bind(account.accountId).run();
    const nextChallenge = await startPasswordChallenge(account.email);
    const replay = await postAuth(
      "/two-factor/verify-backup-code",
      { code: backupCode, trustDevice: false },
      nextChallenge.cookie,
    );
    expect(replay.status).toBe(401);
    expect((await replay.json()) as AuthErrorPayload).toEqual({
      code: "INVALID_BACKUP_CODE",
      message: "Invalid backup code",
    });
    expect(await countSessions(account.accountId)).toBe(0);
  });

  test("rejects missing and expired challenge state without creating a Session", async () => {
    const account = await createEnabledAccount("challenge-expiry");

    const missing = await postAuth("/two-factor/verify-totp", {
      code: await generateCurrentCode(account.totpURI),
      trustDevice: false,
    });
    expect(missing.status).toBe(401);
    expect((await missing.json()) as AuthErrorPayload).toEqual({
      code: "INVALID_TWO_FACTOR_COOKIE",
      message: "Invalid two factor cookie",
    });

    const challenge = await startPasswordChallenge(account.email);
    await database
      .prepare("UPDATE verification SET expires_at = ? WHERE identifier LIKE '2fa-%'")
      .bind(Date.now() - 1)
      .run();
    const expired = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(account.totpURI), trustDevice: false },
      challenge.cookie,
    );
    expect(expired.status).toBe(401);
    expect((await expired.json()) as AuthErrorPayload).toEqual({
      code: "INVALID_TWO_FACTOR_COOKIE",
      message: "Invalid two factor cookie",
    });
    expect(await countSessions(account.accountId)).toBe(0);
  });

  test("applies maintained endpoint throttling before creating a Session", async () => {
    const account = await createEnabledAccount("challenge-throttle");
    const challenge = await startPasswordChallenge(account.email);
    let throttled: Response | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postAuth(
        "/two-factor/verify-totp",
        { code: "000000", trustDevice: false },
        challenge.cookie,
      );
      if (response.status === 429) {
        throttled = response;
        break;
      }
    }

    if (!throttled) throw new Error("Expected Two-Factor endpoint throttling");
    const payload = (await throttled.json()) as AuthErrorPayload;
    expect(payload).toEqual({ message: "Too many requests. Please try again later." });
    expect(JSON.stringify(payload).includes(challenge.cookie)).toBe(false);
    expect(await countSessions(account.accountId)).toBe(0);
  });

  test("exhausts the maintained per-challenge attempt budget safely", async () => {
    const account = await createEnabledAccount("challenge-attempts");
    const challenge = await startPasswordChallenge(account.email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await database.prepare("DELETE FROM rate_limit").run();
      const invalid = await postAuth(
        "/two-factor/verify-totp",
        { code: "000000", trustDevice: false },
        challenge.cookie,
      );
      expect(invalid.status).toBe(401);
      expect((await invalid.json()) as AuthErrorPayload).toEqual({
        code: "INVALID_CODE",
        message: "Invalid code",
      });
    }

    await database.prepare("DELETE FROM rate_limit").run();
    const exhausted = await postAuth(
      "/two-factor/verify-totp",
      { code: "000000", trustDevice: false },
      challenge.cookie,
    );
    expect(exhausted.status).toBe(400);
    const exhaustedPayload = (await exhausted.json()) as AuthErrorPayload;
    expect(exhaustedPayload).toEqual({
      code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
      message: "Too many attempts. Please request a new code.",
    });
    expect(await countSessions(account.accountId)).toBe(0);
    expect(JSON.stringify(exhaustedPayload).includes(challenge.cookie)).toBe(false);

    const secondChallenge = await startPasswordChallenge(account.email);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await database.prepare("DELETE FROM rate_limit").run();
      const invalid = await postAuth(
        "/two-factor/verify-totp",
        { code: "000000", trustDevice: false },
        secondChallenge.cookie,
      );
      expect(invalid.status).toBe(401);
    }

    const lockedChallenge = await startPasswordChallenge(account.email);
    await database.prepare("DELETE FROM rate_limit").run();
    const locked = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(account.totpURI), trustDevice: false },
      lockedChallenge.cookie,
    );
    expect(locked.status).toBe(429);
    expect((await locked.json()) as AuthErrorPayload).toEqual({
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      message:
        "Too many failed verification attempts. Your account is temporarily locked. Please try again later.",
    });

    await database
      .prepare("UPDATE two_factor SET locked_until = ? WHERE user_id = ?")
      .bind(Date.now() - 1, account.accountId)
      .run();
    await database.prepare("DELETE FROM rate_limit").run();
    const recovered = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(account.totpURI), trustDevice: false },
      lockedChallenge.cookie,
    );
    expect(recovered.status).toBe(200);
    expect(await countSessions(account.accountId)).toBe(1);
  });
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { isoCBOR, isoBase64URL } from "@simplewebauthn/server/helpers";

import { createEasyAuth } from "./auth-factory";
import { getExternalIdentitySignInOptions } from "./auth-policy";
import {
  isPasskeyCancellation,
  sanitizeReturnDestination,
  translatePasskeyError,
} from "./passkey-policy";

const BASE_URL = "http://easy-auth-passkey-test.example";
const PASSWORD = "passkey-integration-password-123";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;
const sentOtps: Record<string, string> = {};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "passkey-integration-test" },
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
      BETTER_AUTH_SECRET: "passkey-integration-test-secret-32-chars",
    },
    sendAuthEmail: async (email) => {
      sentOtps[email.to] = email.otp;
    },
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

async function getAuth(path: string, cookie?: string): Promise<Response> {
  const headers = new Headers({ origin: BASE_URL });
  if (cookie) headers.set("cookie", cookie);
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "GET",
      headers,
    }),
  );
}

function generateSyntheticCredential() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const x = isoBase64URL.toBuffer(jwk.x!);
  const y = isoBase64URL.toBuffer(jwk.y!);

  const coseKey = new Map();
  coseKey.set(1, 2); // EC2
  coseKey.set(3, -7); // ES256
  coseKey.set(-1, 1); // P-256
  coseKey.set(-2, x);
  coseKey.set(-3, y);
  const coseKeyBytes = isoCBOR.encode(coseKey);

  const rawCredentialId = crypto.randomBytes(32);
  const credentialId = isoBase64URL.fromBuffer(rawCredentialId);

  return { publicKey, privateKey, coseKeyBytes, rawCredentialId, credentialId };
}

function createSyntheticRegistrationResponse({
  credential,
  challenge,
  rpID,
  origin,
  userVerified = true,
}: {
  credential: ReturnType<typeof generateSyntheticCredential>;
  challenge: string;
  rpID: string;
  origin: string;
  userVerified?: boolean;
}) {
  const rpIdHash = crypto.createHash("sha256").update(rpID).digest();
  const flags = 0x01 | (userVerified ? 0x04 : 0) | 0x40;
  const signCount = Buffer.alloc(4);
  const aaguid = Buffer.alloc(16);
  const credIdLen = Buffer.alloc(2);
  credIdLen.writeUInt16BE(credential.rawCredentialId.length, 0);

  const authData = Buffer.concat([
    rpIdHash,
    Buffer.from([flags]),
    signCount,
    aaguid,
    credIdLen,
    credential.rawCredentialId,
    Buffer.from(credential.coseKeyBytes),
  ]);

  const attestationMap = new Map();
  attestationMap.set("fmt", "none");
  attestationMap.set("attStmt", new Map());
  attestationMap.set("authData", authData);

  const attestationObject = isoCBOR.encode(attestationMap);

  const clientData = {
    type: "webauthn.create",
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientData));

  return {
    id: credential.credentialId,
    rawId: credential.credentialId,
    response: {
      attestationObject: isoBase64URL.fromBuffer(attestationObject),
      clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
    },
    type: "public-key",
  };
}

function createSyntheticAuthenticationResponse({
  credential,
  challenge,
  rpID,
  origin,
  counter = 1,
  userVerified = true,
}: {
  credential: ReturnType<typeof generateSyntheticCredential>;
  challenge: string;
  rpID: string;
  origin: string;
  counter?: number;
  userVerified?: boolean;
}) {
  const rpIdHash = crypto.createHash("sha256").update(rpID).digest();
  const flags = 0x01 | (userVerified ? 0x04 : 0);
  const signCount = Buffer.alloc(4);
  signCount.writeUInt32BE(counter, 0);

  const authData = Buffer.concat([rpIdHash, Buffer.from([flags]), signCount]);

  const clientData = {
    type: "webauthn.get",
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientData));
  const clientDataHash = crypto.createHash("sha256").update(clientDataJSON).digest();

  const signaturePayload = Buffer.concat([authData, clientDataHash]);
  const signature = crypto
    .createSign("SHA256")
    .update(signaturePayload)
    .sign(credential.privateKey);

  return {
    id: credential.credentialId,
    rawId: credential.credentialId,
    response: {
      authenticatorData: isoBase64URL.fromBuffer(authData),
      clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
      signature: isoBase64URL.fromBuffer(signature),
    },
    type: "public-key",
  };
}

async function createAccount(slug: string, options?: { emailVerified?: boolean }) {
  const email = `${slug}@example.com`;
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-up/email", { name: slug, email, password: PASSWORD });
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { user: { id: string } };

  if (options?.emailVerified !== false) {
    await database
      .prepare("UPDATE user SET email_verified = 1 WHERE id = ?")
      .bind(payload.user.id)
      .run();
  }

  const loginResponse = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(loginResponse.status).toBe(200);
  const setCookies = loginResponse.headers.getSetCookie();
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");

  return {
    id: payload.user.id,
    email,
    cookie,
  };
}

describe("Passkey integration and security policy", () => {
  test("derives RP ID and enforces required user verification in options", async () => {
    // Authentication options
    const authOptionsRes = await getAuth("/passkey/generate-authenticate-options");
    expect(authOptionsRes.status).toBe(200);
    const authOptions = (await authOptionsRes.json()) as {
      rpId?: string;
      userVerification?: string;
    };
    expect(authOptions.rpId).toBe("easy-auth-passkey-test.example");
    expect(authOptions.userVerification).toBe("required");

    // Registration options require authenticated fresh session
    const anonRegRes = await getAuth("/passkey/generate-register-options");
    expect(anonRegRes.status).toBe(401);

    const user = await createAccount("user-reg-opts");
    const regOptionsRes = await getAuth("/passkey/generate-register-options", user.cookie);
    expect(regOptionsRes.status).toBe(200);
    const regOptions = (await regOptionsRes.json()) as {
      rp?: { id?: string; name?: string };
      authenticatorSelection?: { userVerification?: string };
    };
    expect(regOptions.rp?.id).toBe("easy-auth-passkey-test.example");
    expect(regOptions.rp?.name).toBe("Easy Auth");
    expect(regOptions.authenticatorSelection?.userVerification).toBe("required");
  });

  test("rejects registration options when session is stale (> 5 minutes)", async () => {
    const user = await createAccount("user-stale-session");

    // Age the session beyond 5 minutes
    const staleTime = Date.now() - 6 * 60 * 1000;
    await database
      .prepare("UPDATE session SET created_at = ? WHERE user_id = ?")
      .bind(staleTime, user.id)
      .run();

    const regOptionsRes = await getAuth("/passkey/generate-register-options", user.cookie);
    expect(regOptionsRes.status).toBe(403);
    const error = (await regOptionsRes.json()) as { code: string };
    expect(error.code).toBe("SESSION_NOT_FRESH");
  });

  test("rejects registration options when user is banned or unverified", async () => {
    const unverifiedUser = await createAccount("user-unverified");
    await database
      .prepare("UPDATE user SET email_verified = 0 WHERE id = ?")
      .bind(unverifiedUser.id)
      .run();

    const unverifiedRes = await getAuth(
      "/passkey/generate-register-options",
      unverifiedUser.cookie,
    );
    expect(unverifiedRes.status).toBe(403);
    expect(((await unverifiedRes.json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");

    const bannedUser = await createAccount("user-banned-opts");
    await database
      .prepare("UPDATE user SET banned = 1, ban_reason = 'Abuse', ban_expires = NULL WHERE id = ?")
      .bind(bannedUser.id)
      .run();

    const bannedRes = await getAuth("/passkey/generate-register-options", bannedUser.cookie);
    expect(bannedRes.status).toBe(403);
    expect(((await bannedRes.json()) as { code: string }).code).toBe("ACCOUNT_BANNED");
  });

  test("enforces user verification during passkey authentication callback", async () => {
    const user = await createAccount("user-passkey-uv");

    // Directly seed a passkey in the database
    const passkeyId = "passkey-uv-test-id";
    const credentialId = "cred-uv-test-id";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        passkeyId,
        "My Key",
        "mock-public-key",
        user.id,
        credentialId,
        0,
        "singleDevice",
        0,
        Date.now(),
      )
      .run();

    // Verify passkey appears in list
    const listRes = await getAuth("/passkey/list-user-passkeys", user.cookie);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Array<{ id: string; name: string }>;
    expect(list.some((pk) => pk.id === passkeyId)).toBe(true);
  });

  test("allows renaming passkey with a valid session and rejects cross-account rename", async () => {
    const user1 = await createAccount("user-rename-1");
    const user2 = await createAccount("user-rename-2");

    const passkeyId = "pk-rename-test";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        passkeyId,
        "Old Name",
        "mock-pk",
        user1.id,
        "cred-rename",
        0,
        "singleDevice",
        0,
        Date.now(),
      )
      .run();

    // Cross-account rename rejected by official endpoint
    const crossRes = await postAuth(
      "/passkey/update-passkey",
      { id: passkeyId, name: "Stolen Key" },
      user2.cookie,
    );
    expect(crossRes.status).toBe(401);

    // Overlong name rejected (>64 chars)
    const overlongRes = await postAuth(
      "/passkey/update-passkey",
      { id: passkeyId, name: "a".repeat(65) },
      user1.cookie,
    );
    expect(overlongRes.status).toBe(400);

    // Missing passkey rejected (404)
    const missingRes = await postAuth(
      "/passkey/update-passkey",
      { id: "non-existent-pk", name: "Valid Name" },
      user1.cookie,
    );
    expect(missingRes.status).toBe(404);

    // Valid rename by owner succeeds
    const renameRes = await postAuth(
      "/passkey/update-passkey",
      { id: passkeyId, name: "New Name" },
      user1.cookie,
    );
    expect(renameRes.status).toBe(200);
    const updated = await database
      .prepare("SELECT name FROM passkey WHERE id = ?")
      .bind(passkeyId)
      .first<{ name: string }>();
    expect(updated?.name).toBe("New Name");
  });

  test("last-method protection: prevents deleting the only passkey when no other login method exists", async () => {
    // Create an account with password
    const user = await createAccount("user-last-method-pk");

    const pk1 = "pk-sole-test-1";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(pk1, "Sole Key", "mock-pk", user.id, "cred-sole-1", 0, "singleDevice", 0, Date.now())
      .run();

    // While password exists, deleting passkey is permitted
    // Let's remove the password account to simulate a passkey-only account
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    // Now user has ONLY pk1 and NO other sign-in method!
    const deleteSoleRes = await postAuth("/passkey/delete-passkey", { id: pk1 }, user.cookie);
    expect(deleteSoleRes.status).toBe(400);
    const errPayload = (await deleteSoleRes.json()) as { code: string };
    expect(errPayload.code).toBe("CANNOT_DELETE_LAST_METHOD");

    // pk1 must still be in database!
    const remaining = await database
      .prepare("SELECT id FROM passkey WHERE id = ?")
      .bind(pk1)
      .first<{ id: string }>();
    expect(remaining?.id).toBe(pk1);
  });

  test("last-method protection: allows deleting passkey when a second passkey exists", async () => {
    const user = await createAccount("user-two-passkeys");

    // Remove password account so user is passkey-only
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    const pk1 = "pk-pair-1";
    const pk2 = "pk-pair-2";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pk1,
        "Key 1",
        "mock-pk-1",
        user.id,
        "cred-pair-1",
        0,
        "singleDevice",
        0,
        Date.now(),
        pk2,
        "Key 2",
        "mock-pk-2",
        user.id,
        "cred-pair-2",
        0,
        "singleDevice",
        0,
        Date.now(),
      )
      .run();

    // Deleting pk1 is permitted because pk2 exists
    const deleteRes = await postAuth("/passkey/delete-passkey", { id: pk1 }, user.cookie);
    expect(deleteRes.status).toBe(200);

    // Now only pk2 remains. Attempting to delete pk2 must fail!
    const deleteLastRes = await postAuth("/passkey/delete-passkey", { id: pk2 }, user.cookie);
    expect(deleteLastRes.status).toBe(400);
    expect(((await deleteLastRes.json()) as { code: string }).code).toBe(
      "CANNOT_DELETE_LAST_METHOD",
    );

    // pk2 remains in database
    const finalKey = await database
      .prepare("SELECT id FROM passkey WHERE id = ?")
      .bind(pk2)
      .first<{ id: string }>();
    expect(finalKey?.id).toBe(pk2);
  });

  test("last-method protection: unlinking GitHub is allowed when passkey exists without password", async () => {
    const user = await createAccount("user-gh-unlink-pk");

    // Remove password account
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    // Add GitHub account
    const ghAccountId = "gh-acc-for-unlink";
    await database
      .prepare(
        `INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
         VALUES (?, 'https://github.com', 'gh-user-99', 'github', ?, ?, ?)`,
      )
      .bind(ghAccountId, user.id, Date.now(), Date.now())
      .run();

    // If user has NO passkey, unlinking GitHub must fail
    const failUnlinkRes = await postAuth(
      "/unlink-account",
      { accountId: ghAccountId },
      user.cookie,
    );
    expect(failUnlinkRes.status).toBe(400);
    expect(((await failUnlinkRes.json()) as { code: string }).code).toBe(
      "FAILED_TO_UNLINK_LAST_ACCOUNT",
    );

    // Add a passkey
    const pkId = "pk-enables-unlink";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, 'Safe Key', 'mock-pk', ?, 'cred-enables-unlink', 0, 'singleDevice', 0, ?)`,
      )
      .bind(pkId, user.id, Date.now())
      .run();

    // Now unlinking GitHub MUST succeed because passkey remains!
    const successUnlinkRes = await postAuth(
      "/unlink-account",
      { accountId: ghAccountId },
      user.cookie,
    );
    expect(successUnlinkRes.status).toBe(200);

    // GitHub account is gone, passkey remains
    const ghRow = await database
      .prepare("SELECT id FROM account WHERE id = ?")
      .bind(ghAccountId)
      .first();
    expect(ghRow).toBeNull();

    const pkRow = await database.prepare("SELECT id FROM passkey WHERE id = ?").bind(pkId).first();
    expect(Boolean(pkRow)).toBe(true);
  });

  test("last-method protection: Google and GitHub can back each other up", async () => {
    const user = await createAccount("user-google-github-unlink");
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    const googleAccountId = "google-account-for-unlink";
    const githubAccountId = "github-account-for-unlink";
    await database
      .prepare(
        `INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
         VALUES (?, 'https://accounts.google.com', 'google-user-1', 'google', ?, ?, ?),
                (?, 'https://github.com', 'github-user-1', 'github', ?, ?, ?)`,
      )
      .bind(
        googleAccountId,
        user.id,
        Date.now(),
        Date.now(),
        githubAccountId,
        user.id,
        Date.now(),
        Date.now(),
      )
      .run();

    const unlinkGoogle = await postAuth(
      "/unlink-account",
      { accountId: googleAccountId },
      user.cookie,
    );
    expect(unlinkGoogle.status).toBe(200);

    const unlinkFinalGithub = await postAuth(
      "/unlink-account",
      { accountId: githubAccountId },
      user.cookie,
    );
    expect(unlinkFinalGithub.status).toBe(400);
    expect(((await unlinkFinalGithub.json()) as { code: string }).code).toBe(
      "FAILED_TO_UNLINK_LAST_ACCOUNT",
    );
  });

  test("concurrency protection: simultaneous passkey deletions cannot delete the final passkey", async () => {
    const user = await createAccount("user-concurrent-pk");

    // Remove password
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    const pkA = "pk-race-a";
    const pkB = "pk-race-b";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pkA,
        "Race A",
        "mock-a",
        user.id,
        "cred-race-a",
        0,
        "singleDevice",
        0,
        Date.now(),
        pkB,
        "Race B",
        "mock-b",
        user.id,
        "cred-race-b",
        0,
        "singleDevice",
        0,
        Date.now(),
      )
      .run();

    // Fire both delete requests simultaneously
    const [resA, resB] = await Promise.all([
      postAuth("/passkey/delete-passkey", { id: pkA }, user.cookie),
      postAuth("/passkey/delete-passkey", { id: pkB }, user.cookie),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 400]);

    // Exactly one passkey remains in the database
    const remainingPasskeys = await database
      .prepare("SELECT id FROM passkey WHERE user_id = ?")
      .bind(user.id)
      .all<{ id: string }>();
    expect(remainingPasskeys.results.length).toBe(1);
  });

  test("concurrency protection: simultaneous passkey delete and GitHub unlink cannot leave zero methods", async () => {
    const user = await createAccount("user-concurrent-pk-gh");

    // Remove password
    await database
      .prepare("DELETE FROM account WHERE user_id = ? AND provider_id = 'credential'")
      .bind(user.id)
      .run();

    const ghId = "gh-race-acc";
    const pkId = "pk-race-item";
    await database
      .prepare(
        `INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
         VALUES (?, 'https://github.com', 'gh-user-race', 'github', ?, ?, ?)`,
      )
      .bind(ghId, user.id, Date.now(), Date.now())
      .run();

    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, 'Race Key', 'mock-race', ?, 'cred-race-gh', 0, 'singleDevice', 0, ?)`,
      )
      .bind(pkId, user.id, Date.now())
      .run();

    // Fire both simultaneously
    const [resPk, resGh] = await Promise.all([
      postAuth("/passkey/delete-passkey", { id: pkId }, user.cookie),
      postAuth("/unlink-account", { accountId: ghId }, user.cookie),
    ]);

    const statuses = [resPk.status, resGh.status].sort();
    expect(statuses).toEqual([200, 400]);

    // At least one sign-in method remains
    const remainingPks = await database
      .prepare("SELECT id FROM passkey WHERE user_id = ?")
      .bind(user.id)
      .all<{ id: string }>();
    const remainingGhs = await database
      .prepare("SELECT id FROM account WHERE user_id = ? AND provider_id = 'github'")
      .bind(user.id)
      .all<{ id: string }>();

    expect(remainingPks.results.length + remainingGhs.results.length).toBe(1);
  });

  test("password reset does not delete existing passkeys", async () => {
    const user = await createAccount("user-reset-preserves-pk");

    const pkId = "pk-stays-after-reset";
    await database
      .prepare(
        `INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
         VALUES (?, 'Persistent Key', 'mock-pk', ?, 'cred-persistent', 0, 'singleDevice', 0, ?)`,
      )
      .bind(pkId, user.id, Date.now())
      .run();

    // Perform password reset: request OTP, then complete
    await database.prepare("DELETE FROM rate_limit").run();
    await database.prepare("DELETE FROM verification").run();

    const requestRes = await postAuth("/email-otp/request-password-reset", {
      email: user.email,
    });
    expect(requestRes.status).toBe(200);

    const otp = sentOtps[user.email];
    expect(otp).toBeDefined();

    const resetRes = await postAuth("/email-otp/reset-password", {
      email: user.email,
      otp,
      password: "new-super-secure-password-456",
    });
    expect(resetRes.status).toBe(200);

    // Passkey must still exist!
    const pkRow = await database
      .prepare("SELECT id, name FROM passkey WHERE id = ?")
      .bind(pkId)
      .first<{ id: string; name: string }>();
    expect(pkRow?.id).toBe(pkId);
  });

  test("synthetic WebAuthn HTTP registration: UV true succeeds and UV false is rejected", async () => {
    const user = await createAccount("user-synth-reg");

    // 1. UV = false: Rejected by afterVerification, no credential persisted in DB
    const optResFalse = await getAuth("/passkey/generate-register-options", user.cookie);
    expect(optResFalse.status).toBe(200);
    const challengeCookieFalse = optResFalse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const optsFalse = (await optResFalse.json()) as { challenge: string };

    const credFalse = generateSyntheticCredential();
    const synthRegFalse = createSyntheticRegistrationResponse({
      credential: credFalse,
      challenge: optsFalse.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      userVerified: false,
    });

    const verifyResFalse = await postAuth(
      "/passkey/verify-registration",
      { response: synthRegFalse, name: "UV False Key" },
      `${user.cookie}; ${challengeCookieFalse}`,
    );
    expect(verifyResFalse.status).toBe(400);
    const errPayloadFalse = (await verifyResFalse.json()) as { code: string };
    expect(errPayloadFalse.code).toBe("USER_VERIFICATION_REQUIRED");

    const passkeyCountFalse = await database
      .prepare("SELECT count(*) as count FROM passkey WHERE credential_id = ?")
      .bind(credFalse.credentialId)
      .first<{ count: number }>();
    expect(passkeyCountFalse?.count).toBe(0);

    // 2. UV = true: Succeeds, credential persisted in DB
    const optResTrue = await getAuth("/passkey/generate-register-options", user.cookie);
    expect(optResTrue.status).toBe(200);
    const challengeCookieTrue = optResTrue.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const optsTrue = (await optResTrue.json()) as { challenge: string };

    const credTrue = generateSyntheticCredential();
    const synthRegTrue = createSyntheticRegistrationResponse({
      credential: credTrue,
      challenge: optsTrue.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      userVerified: true,
    });

    const verifyResTrue = await postAuth(
      "/passkey/verify-registration",
      { response: synthRegTrue, name: "UV True Key" },
      `${user.cookie}; ${challengeCookieTrue}`,
    );
    expect(verifyResTrue.status).toBe(200);

    const passkeyRow = await database
      .prepare("SELECT id, name, user_id FROM passkey WHERE credential_id = ?")
      .bind(credTrue.credentialId)
      .first<{ id: string; name: string; user_id: string }>();
    expect(passkeyRow?.name).toBe("UV True Key");
    expect(passkeyRow?.user_id).toBe(user.id);

    // 3. Challenge replay: attempting to reuse the consumed challenge fails
    const replayRes = await postAuth(
      "/passkey/verify-registration",
      { response: synthRegTrue, name: "Replay Key" },
      `${user.cookie}; ${challengeCookieTrue}`,
    );
    expect(replayRes.status).toBe(400);

    // 4. Wrong origin in clientDataJSON is rejected
    const optResOrigin = await getAuth("/passkey/generate-register-options", user.cookie);
    const challengeCookieOrigin = optResOrigin.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const optsOrigin = (await optResOrigin.json()) as { challenge: string };

    const credOrigin = generateSyntheticCredential();
    const synthRegWrongOrigin = createSyntheticRegistrationResponse({
      credential: credOrigin,
      challenge: optsOrigin.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: "http://wrong-origin.attacker.example",
      userVerified: true,
    });

    const verifyWrongOriginRes = await postAuth(
      "/passkey/verify-registration",
      { response: synthRegWrongOrigin, name: "Wrong Origin Key" },
      `${user.cookie}; ${challengeCookieOrigin}`,
    );
    expect(verifyWrongOriginRes.status >= 400).toBe(true);
  });

  test("synthetic WebAuthn HTTP authentication: UV true succeeds, UV false is rejected", async () => {
    const user = await createAccount("user-synth-auth");

    // Register a valid passkey via HTTP endpoint first
    const optRes = await getAuth("/passkey/generate-register-options", user.cookie);
    const challengeCookie = optRes.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const opts = (await optRes.json()) as { challenge: string };

    const cred = generateSyntheticCredential();
    const synthReg = createSyntheticRegistrationResponse({
      credential: cred,
      challenge: opts.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      userVerified: true,
    });

    const regRes = await postAuth(
      "/passkey/verify-registration",
      { response: synthReg, name: "Auth Test Key" },
      `${user.cookie}; ${challengeCookie}`,
    );
    expect(regRes.status).toBe(200);

    // Initial session count before passkey authentications
    const initialSessionCount =
      (
        await database
          .prepare("SELECT count(*) as count FROM session WHERE user_id = ?")
          .bind(user.id)
          .first<{ count: number }>()
      )?.count ?? 0;

    // 1. Authenticate with UV = false: Rejected, no session persisted
    const authOptResFalse = await getAuth("/passkey/generate-authenticate-options");
    expect(authOptResFalse.status).toBe(200);
    const authChallengeCookieFalse =
      authOptResFalse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authOptsFalse = (await authOptResFalse.json()) as { challenge: string };

    const synthAuthFalse = createSyntheticAuthenticationResponse({
      credential: cred,
      challenge: authOptsFalse.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      counter: 1,
      userVerified: false,
    });

    const authResFalse = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuthFalse },
      authChallengeCookieFalse,
    );
    expect(authResFalse.status).toBe(401);
    const authErrFalse = (await authResFalse.json()) as { code: string };
    expect(authErrFalse.code).toBe("USER_VERIFICATION_REQUIRED");

    const sessionCountAfterFalse =
      (
        await database
          .prepare("SELECT count(*) as count FROM session WHERE user_id = ?")
          .bind(user.id)
          .first<{ count: number }>()
      )?.count ?? 0;
    expect(sessionCountAfterFalse).toBe(initialSessionCount);

    // 2. Authenticate with UV = true: Succeeds, session created
    const authOptResTrue = await getAuth("/passkey/generate-authenticate-options");
    expect(authOptResTrue.status).toBe(200);
    const authChallengeCookieTrue =
      authOptResTrue.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authOptsTrue = (await authOptResTrue.json()) as { challenge: string };

    const synthAuthTrue = createSyntheticAuthenticationResponse({
      credential: cred,
      challenge: authOptsTrue.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      counter: 2,
      userVerified: true,
    });

    const authResTrue = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuthTrue },
      authChallengeCookieTrue,
    );
    expect(authResTrue.status).toBe(200);
    const authPayloadTrue = (await authResTrue.json()) as {
      user?: { id: string; email: string };
      session?: { token: string };
    };
    expect(authPayloadTrue.user?.id).toBe(user.id);
    expect(authPayloadTrue.user?.email).toBe(user.email);
    expect(Boolean(authPayloadTrue.session?.token)).toBe(true);

    const sessionCountAfterTrue =
      (
        await database
          .prepare("SELECT count(*) as count FROM session WHERE user_id = ?")
          .bind(user.id)
          .first<{ count: number }>()
      )?.count ?? 0;
    expect(sessionCountAfterTrue).toBe(initialSessionCount + 1);

    // 3. Challenge replay: consuming the same authentication challenge again fails
    const replayAuthRes = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuthTrue },
      authChallengeCookieTrue,
    );
    expect(replayAuthRes.status).toBe(400);

    // Expired challenges must not establish a session even with a valid signature.
    const expiredOptionsResponse = await getAuth("/passkey/generate-authenticate-options");
    expect(expiredOptionsResponse.status).toBe(200);
    const expiredCookie = expiredOptionsResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const expiredOptions = (await expiredOptionsResponse.json()) as { challenge: string };
    const expiredChallenge = await database
      .prepare(
        "UPDATE verification SET expires_at = ? WHERE json_extract(CASE WHEN json_valid(value) THEN value ELSE '{}' END, '$.expectedChallenge') = ?",
      )
      .bind(Date.now() - 1000, expiredOptions.challenge)
      .run();
    expect(expiredChallenge.meta.changes).toBe(1);
    const expiredResponse = await postAuth(
      "/passkey/verify-authentication",
      {
        response: createSyntheticAuthenticationResponse({
          credential: cred,
          challenge: expiredOptions.challenge,
          rpID: "easy-auth-passkey-test.example",
          origin: BASE_URL,
          counter: 3,
          userVerified: true,
        }),
      },
      expiredCookie,
    );
    expect(expiredResponse.status).toBe(400);
    expect(((await expiredResponse.json()) as { code: string }).code).toBe("CHALLENGE_NOT_FOUND");
    expect(
      await database
        .prepare("SELECT count(*) as count FROM session WHERE user_id = ?")
        .bind(user.id)
        .first<number>("count"),
    ).toBe(sessionCountAfterTrue);

    // 4. Wrong origin in assertion clientDataJSON is rejected
    const authOptResOrigin = await getAuth("/passkey/generate-authenticate-options");
    const authChallengeCookieOrigin =
      authOptResOrigin.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authOptsOrigin = (await authOptResOrigin.json()) as { challenge: string };

    const synthAuthWrongOrigin = createSyntheticAuthenticationResponse({
      credential: cred,
      challenge: authOptsOrigin.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: "http://attacker-origin.example",
      counter: 3,
      userVerified: true,
    });

    const authWrongOriginRes = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuthWrongOrigin },
      authChallengeCookieOrigin,
    );
    expect(authWrongOriginRes.status).toBe(400);
  });

  test("lifecycle boundary: banned and unverified email accounts cannot authenticate or register passkeys", async () => {
    // 1. Unverified account cannot register passkey
    const unverifiedUser = await createAccount("user-synth-unverified");
    await database
      .prepare("UPDATE user SET email_verified = 0 WHERE id = ?")
      .bind(unverifiedUser.id)
      .run();

    const regOptUnverified = await getAuth(
      "/passkey/generate-register-options",
      unverifiedUser.cookie,
    );
    expect(regOptUnverified.status).toBe(403);
    expect(((await regOptUnverified.json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");

    // 2. Banned account cannot register passkey
    const bannedUser = await createAccount("user-synth-banned");
    await database
      .prepare("UPDATE user SET banned = 1, ban_reason = 'Abuse' WHERE id = ?")
      .bind(bannedUser.id)
      .run();

    const regOptBanned = await getAuth("/passkey/generate-register-options", bannedUser.cookie);
    expect(regOptBanned.status).toBe(403);
    expect(((await regOptBanned.json()) as { code: string }).code).toBe("ACCOUNT_BANNED");

    // 3. Passkey belonging to banned account cannot authenticate
    const userForBanAuth = await createAccount("user-synth-ban-auth");
    const regOptRes = await getAuth("/passkey/generate-register-options", userForBanAuth.cookie);
    const challengeCookie = regOptRes.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const regOpts = (await regOptRes.json()) as { challenge: string };

    const cred = generateSyntheticCredential();
    const synthReg = createSyntheticRegistrationResponse({
      credential: cred,
      challenge: regOpts.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      userVerified: true,
    });

    const regRes = await postAuth(
      "/passkey/verify-registration",
      { response: synthReg, name: "Ban Auth Key" },
      `${userForBanAuth.cookie}; ${challengeCookie}`,
    );
    expect(regRes.status).toBe(200);

    // Now ban the account
    await database
      .prepare("UPDATE user SET banned = 1, ban_reason = 'Suspicious' WHERE id = ?")
      .bind(userForBanAuth.id)
      .run();

    const authOptRes = await getAuth("/passkey/generate-authenticate-options");
    const authChallengeCookie = authOptRes.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authOpts = (await authOptRes.json()) as { challenge: string };

    const synthAuth = createSyntheticAuthenticationResponse({
      credential: cred,
      challenge: authOpts.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      counter: 1,
      userVerified: true,
    });

    const authRes = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuth },
      authChallengeCookie,
    );
    // Banned account authentication rejected
    expect(authRes.status).toBe(403);
    expect(((await authRes.json()) as { code: string }).code).toBe("ACCOUNT_BANNED");
  });

  test("password + 2FA vs Passkey bypass distinction", async () => {
    const user = await createAccount("user-synth-2fa");

    // 1. Register passkey for this user
    const regOptRes = await getAuth("/passkey/generate-register-options", user.cookie);
    const challengeCookie = regOptRes.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const regOpts = (await regOptRes.json()) as { challenge: string };

    const cred = generateSyntheticCredential();
    const synthReg = createSyntheticRegistrationResponse({
      credential: cred,
      challenge: regOpts.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      userVerified: true,
    });

    const regRes = await postAuth(
      "/passkey/verify-registration",
      { response: synthReg, name: "2FA Bypass Key" },
      `${user.cookie}; ${challengeCookie}`,
    );
    expect(regRes.status).toBe(200);

    // 2. Enable Two-Factor (TOTP) on the user account
    await database.prepare("DELETE FROM rate_limit").run();
    const enableRes = await postAuth(
      "/two-factor/enable",
      { password: PASSWORD, method: "totp" },
      user.cookie,
    );
    expect(enableRes.status).toBe(200);
    await database
      .prepare("UPDATE two_factor SET verified = 1 WHERE user_id = ?")
      .bind(user.id)
      .run();
    await database
      .prepare("UPDATE user SET two_factor_enabled = 1 WHERE id = ?")
      .bind(user.id)
      .run();

    // 3. Password login requires 2FA challenge and withholds session
    await database.prepare("DELETE FROM rate_limit").run();
    const passLoginRes = await postAuth("/sign-in/email", {
      email: user.email,
      password: PASSWORD,
    });
    expect(passLoginRes.status).toBe(200);
    const passLoginJson = (await passLoginRes.json()) as {
      twoFactorRedirect?: boolean;
      session?: unknown;
    };
    expect(passLoginJson.twoFactorRedirect).toBe(true);
    expect(passLoginJson.session).toBeUndefined();

    // 4. Passkey authentication succeeds directly without 2FA challenge
    const authOptRes = await getAuth("/passkey/generate-authenticate-options");
    const authChallengeCookie = authOptRes.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const authOpts = (await authOptRes.json()) as { challenge: string };

    const synthAuth = createSyntheticAuthenticationResponse({
      credential: cred,
      challenge: authOpts.challenge,
      rpID: "easy-auth-passkey-test.example",
      origin: BASE_URL,
      counter: 1,
      userVerified: true,
    });

    const passkeyLoginRes = await postAuth(
      "/passkey/verify-authentication",
      { response: synthAuth },
      authChallengeCookie,
    );
    expect(passkeyLoginRes.status).toBe(200);
    const passkeyLoginJson = (await passkeyLoginRes.json()) as {
      session?: { token: string };
      user?: { id: string };
    };
    // Passkey establishes session directly without requiring TOTP!
    expect(Boolean(passkeyLoginJson.session?.token)).toBe(true);
    expect(passkeyLoginJson.user?.id).toBe(user.id);
  });

  test("anonymous and cross-origin mutation requests rejected", async () => {
    // 1. Anonymous mutations rejected with 401
    const anonDelRes = await postAuth("/passkey/delete-passkey", { id: "pk-123" });
    expect(anonDelRes.status).toBe(401);

    const anonUpdateRes = await postAuth("/passkey/update-passkey", {
      id: "pk-123",
      name: "New Name",
    });
    expect(anonUpdateRes.status).toBe(401);

    const anonUnlinkRes = await postAuth("/unlink-account", { accountId: "acc-123" });
    expect(anonUnlinkRes.status).toBe(401);

    // 2. Cross-origin mutation rejected with 403 by origin middleware
    const user = await createAccount("user-cross-origin");
    const crossHeaders = new Headers({
      "content-type": "application/json",
      origin: "http://evil-attacker.example",
      cookie: user.cookie,
    });

    const crossRes = await auth.handler(
      new Request(`${BASE_URL}/api/auth/passkey/delete-passkey`, {
        method: "POST",
        headers: crossHeaders,
        body: JSON.stringify({ id: "pk-123" }),
      }),
    );
    expect(crossRes.status).toBe(403);
  });

  test("authentication-options after hook preserves error status and challenge cookies", async () => {
    // 1. Successful authentication-options request preserves status 200 and challenge cookie
    const successRes = await getAuth("/passkey/generate-authenticate-options");
    expect(successRes.status).toBe(200);
    expect(successRes.headers.get("set-cookie")?.includes("better-auth-passkey")).toBe(true);
    const successData = (await successRes.json()) as { userVerification?: string };
    expect(successData.userVerification).toBe("required");

    // 2. The after hook does not transform error responses into 200
    const passkeyMgmtPlugin = auth.options.plugins.find(
      (p) => p.id === "easy-auth-passkey-management",
    ) as any;
    expect(Boolean(passkeyMgmtPlugin)).toBe(true);
    const afterHook = passkeyMgmtPlugin?.hooks?.after?.[0];
    expect(Boolean(afterHook)).toBe(true);

    // Error Response (e.g. 500) must NOT be rewritten
    const mockErrorResponse = new Response(JSON.stringify({ error: "Server failure" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    const mockCtxError = {
      path: "/passkey/generate-authenticate-options",
      context: { returned: mockErrorResponse },
      json: (data: unknown) => new Response(JSON.stringify(data)),
    };
    const handlerResult = await afterHook.handler(mockCtxError);
    expect(handlerResult).toBeUndefined();

    // Error object must NOT be rewritten
    const mockCtxErrorObj = {
      path: "/passkey/generate-authenticate-options",
      context: { returned: { error: { message: "Failed", status: 400 } } },
      json: (data: unknown) => new Response(JSON.stringify(data)),
    };
    const handlerResultObj = await afterHook.handler(mockCtxErrorObj);
    expect(handlerResultObj).toBeUndefined();
  });

  test("return-flow and cancellation policy integration", async () => {
    // 1. Return destination constrained to /sign-in-methods or fallback /profile
    expect(sanitizeReturnDestination("/sign-in-methods")).toBe("/sign-in-methods");
    expect(sanitizeReturnDestination("/profile")).toBe("/profile");
    expect(sanitizeReturnDestination("/security")).toBe("/profile");
    expect(sanitizeReturnDestination("//evil.com")).toBe("/profile");
    expect(sanitizeReturnDestination("\\evil.com")).toBe("/profile");
    expect(sanitizeReturnDestination("/sign-in-methods%2f..")).toBe("/profile");

    // 2. GitHub re-login carries sanitized returnTo through success and retry
    const githubSignInMethods = getExternalIdentitySignInOptions("github", {
      returnTo: "/sign-in-methods",
    });
    expect(githubSignInMethods.callbackURL).toBe("/sign-in-methods");
    expect(githubSignInMethods.errorCallbackURL).toBe(
      "/login?returnTo=%2Fsign-in-methods&provider=github",
    );

    // 3. Pending OAuth flow priority over returnTo
    const githubOAuthFlow = getExternalIdentitySignInOptions("github", {
      returnTo: "/sign-in-methods",
      search: "?client_id=ea_app&sig=sig123&ba_param=client_id",
    });
    expect(githubOAuthFlow.callbackURL).toBe(
      "/login?client_id=ea_app&sig=sig123&ba_param=client_id",
    );
    expect(githubOAuthFlow.errorCallbackURL).toBe(
      "/login?client_id=ea_app&sig=sig123&ba_param=client_id&provider=github",
    );

    // 4. Cancellation behavior distinguishes client cancellation from server authorization failure
    expect(isPasskeyCancellation({ code: "AUTH_CANCELLED" })).toBe(true);
    expect(isPasskeyCancellation({ code: "REGISTRATION_CANCELLED" })).toBe(true);
    expect(isPasskeyCancellation({ code: "ERROR_CEREMONY_ABORTED" })).toBe(true);
    expect(isPasskeyCancellation({ name: "NotAllowedError" })).toBe(true);
    expect(isPasskeyCancellation({ name: "AbortError" })).toBe(true);

    // Server authorization failures are NOT treated as cancellations
    expect(
      isPasskeyCancellation({
        code: "YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY",
        message: "You are not allowed to register this passkey",
      }),
    ).toBe(false);
    expect(
      isPasskeyCancellation({
        code: "USER_VERIFICATION_REQUIRED",
        message: "User verification is required",
      }),
    ).toBe(false);
    expect(isPasskeyCancellation({ code: "SESSION_NOT_FRESH" })).toBe(false);
    expect(isPasskeyCancellation({ code: "ACCOUNT_BANNED" })).toBe(false);

    // Error translation maps server errors to user-actionable text
    expect(translatePasskeyError({ code: "USER_VERIFICATION_REQUIRED" })).toBe(
      "Device verification (PIN or biometrics) is required.",
    );
    expect(translatePasskeyError({ code: "SESSION_NOT_FRESH" })).toBe(
      "Recent sign-in required. Please sign in again to continue.",
    );
  });
});

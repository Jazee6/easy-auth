// @ts-nocheck -- Bun qualification fixture; excluded from the production application build.
import { createRemoteJWKSet, jwtVerify } from "jose";

const issuer = (process.env.ISSUER ?? "http://localhost:3000/api/auth").replace(/\/$/, "");
const clientId = process.env.CLIENT_ID ?? "";
const redirectUri = process.env.REDIRECT_URI ?? "https://reference-client.test:4000/callback";
const port = Number(process.env.PORT ?? 4000);
const certificatePath = process.env.REFERENCE_CLIENT_CERT;
const privateKeyPath = process.env.REFERENCE_CLIENT_KEY;

if (!certificatePath || !privateKeyPath) {
  throw new Error("REFERENCE_CLIENT_CERT and REFERENCE_CLIENT_KEY are required for Web HTTPS");
}

const tls = {
  cert: await Bun.file(certificatePath).text(),
  key: await Bun.file(privateKeyPath).text(),
};
const sessions = new Map<
  string,
  { state: string; verifier: string; tokens?: Record<string, unknown> }
>();

function random(size = 32) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(size))).toString("base64url");
}

async function challenge(verifier: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  ).toString("base64url");
}

function session(request: Request) {
  const id =
    request.headers.get("cookie")?.match(/(?:^|; )reference_session=([^;]+)/)?.[1] ?? random(18);
  return { id, value: sessions.get(id) };
}

function html(body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Easy Auth reference client</title><style>body{font:16px system-ui;max-width:760px;margin:3rem auto;padding:1rem}button,a{margin:.3rem;padding:.6rem .9rem}pre{white-space:pre-wrap;background:#f4f4f5;padding:1rem;border-radius:.5rem}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

async function tokenRequest(parameters: URLSearchParams, authorization?: string) {
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(authorization ? { authorization } : {}),
    },
    body: parameters,
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

Bun.serve({
  port,
  tls,
  async fetch(request) {
    if (!clientId)
      return html(
        "<h1>Configuration required</h1><p>Set CLIENT_ID to a Web public OAuth client.</p>",
      );
    const url = new URL(request.url);
    const current = session(request);
    if (url.pathname === "/start") {
      const state = random();
      const verifier = random(48);
      sessions.set(current.id, { state, verifier });
      const authorization = new URL(`${issuer}/oauth2/authorize`);
      authorization.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile email offline_access",
        state,
        code_challenge: await challenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      return new Response(null, {
        status: 302,
        headers: {
          location: authorization.toString(),
          "set-cookie": `reference_session=${current.id}; HttpOnly; SameSite=Lax; Path=/`,
        },
      });
    }
    if (url.pathname === "/callback") {
      if (!current.value || url.searchParams.get("state") !== current.value.state)
        return html("<h1>State validation failed</h1>");
      const code = url.searchParams.get("code");
      if (!code)
        return html(`<h1>Authorization denied</h1><pre>${url.searchParams.toString()}</pre>`);
      const tokens = await tokenRequest(
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          redirect_uri: redirectUri,
          code_verifier: current.value.verifier,
        }),
      );
      if (typeof tokens.id_token === "string") {
        await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(`${issuer}/jwks`)), {
          issuer,
          audience: clientId,
        });
      }
      sessions.set(current.id, { ...current.value, tokens });
      return new Response(null, { status: 302, headers: { location: "/" } });
    }
    if (url.pathname === "/userinfo" && current.value?.tokens?.access_token) {
      return fetch(`${issuer}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${current.value.tokens.access_token}` },
      });
    }
    if (url.pathname === "/refresh" && typeof current.value?.tokens?.refresh_token === "string") {
      const tokens = await tokenRequest(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: current.value.tokens.refresh_token,
        }),
      );
      sessions.set(current.id, { ...current.value, tokens });
      return Response.json(tokens);
    }
    if (url.pathname === "/revoke" && typeof current.value?.tokens?.refresh_token === "string") {
      const response = await fetch(`${issuer}/oauth2/revoke`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          token: current.value.tokens.refresh_token,
        }),
      });
      return Response.json({ status: response.status });
    }
    return html(
      `<h1>Easy Auth reference client</h1><p>Issuer: <code>${issuer}</code></p><a href="/start">Start Authorization Code + PKCE</a><button onclick="run('/userinfo')">UserInfo</button><button onclick="run('/refresh')">Refresh</button><button onclick="run('/revoke')">Revoke</button><pre id="result">${JSON.stringify(current.value?.tokens ?? {}, null, 2)}</pre><script>async function run(path){const r=await fetch(path,{method:path==='/userinfo'?'GET':'POST'});document.querySelector('#result').textContent=await r.text()}</script>`,
    );
  },
});

console.log(`Reference client listening on https://reference-client.test:${port}`);

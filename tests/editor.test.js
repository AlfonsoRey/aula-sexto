import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT, generateKeyPair } from "jose";
import { createHandler, configuration } from "../editor/src/worker.js";
import { verifyAccess } from "../editor/src/access.js";
import { OAuthSessions } from "../editor/src/sessions.js";

const instant = Date.now();
function storage() {
  const data = new Map();
  let lock = Promise.resolve();
  const store = {
    async get(key) { return data.get(key); },
    async put(key, value) { data.set(key, value); },
    async delete(key) { return data.delete(key); },
    async deleteAll() { data.clear(); },
    async setAlarm() {},
    transaction(callback) {
      const job = lock.then(() => callback(store));
      lock = job.catch(() => {});
      return job;
    }
  };
  return store;
}
function environment() {
  const sessions = new Map();
  return {
    EDITOR_ORIGIN: "https://editor.example.com", PUBLIC_ORIGIN: "https://aula.example.com",
    ACCESS_ISSUER: "https://team.cloudflareaccess.com", ACCESS_AUD: "audience",
    ACCESS_EMAIL: "editor@example.com", GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret",
    GITHUB_LOGIN: "AlfonsoRey", GITHUB_SCOPE: "public_repo",
    SESSIONS: {
      idFromName: (id) => id,
      get(id) {
        if (!sessions.has(id)) sessions.set(id, new OAuthSessions({ storage: storage() }));
        return sessions.get(id);
      }
    },
    ASSETS: { fetch: async () => new Response("Editor") }
  };
}
function request(path, overrides = {}) {
  return new Request(`https://editor.example.com${path}`, {
    ...overrides,
    headers: { "Cf-Access-Jwt-Assertion": "test-jwt", ...overrides.headers }
  });
}
function handler(extra = {}) {
  return createHandler({
    now: () => instant,
    verifyAccess: async () => ({ sub: "owner", email: "editor@example.com" }),
    fetch: async (url) => {
      if (url.includes("/access_token")) return Response.json({ token_type: "bearer", access_token: "test-token" });
      if (url.endsWith("/user")) return Response.json({ login: "AlfonsoRey" });
      return Response.json({ full_name: "AlfonsoRey/aula-sexto", permissions: { push: true }, private: false });
    },
    ...extra
  });
}
async function start(handle, env) {
  const response = await handle(request("/auth?provider=github&site_id=editor.example.com&scope=repo"), env);
  assert.equal(response.status, 302);
  const state = new URL(response.headers.get("Location")).searchParams.get("state");
  const cookie = response.headers.get("Set-Cookie").split(";")[0];
  return { state, cookie, response };
}
test("Configuración vacía falla cerrada, incluso para assets", async () => {
  const handle = handler();
  assert.equal((await handle(request("/"), {})).status, 503);
  const env = environment();
  env.ACCESS_ISSUER = "https://evil.example.com";
  assert.throws(() => configuration(env));
});
test("JWT Access con firma real, audiencia, emisor, caducidad y algoritmo", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const config = configuration(environment());
  const sign = async (changes = {}) => new SignJWT({ email: config.email })
    .setProtectedHeader({ alg: "RS256" }).setSubject("owner").setIssuedAt()
    .setIssuer(changes.issuer || config.issuer).setAudience(changes.audience || config.audience)
    .setExpirationTime(changes.exp || "5m").sign(privateKey);
  assert.equal((await verifyAccess(await sign(), config, publicKey)).sub, "owner");
  await assert.rejects(verifyAccess(await sign({ audience: "other" }), config, publicKey));
  await assert.rejects(verifyAccess(await sign({ issuer: "https://other.cloudflareaccess.com" }), config, publicKey));
  await assert.rejects(verifyAccess(await sign({ exp: 1 }), config, publicKey));
  const wrong = await generateKeyPair("RS256");
  await assert.rejects(verifyAccess(await sign(), config, wrong.publicKey));
});
test("Access ausente, inválido, identidad ajena y hostname alternativo", async () => {
  const env = environment();
  for (const path of ["/", "/vendor/decap-cms.js", "/config.yml", "/auth", "/callback"]) {
    assert.equal((await handler()(new Request(`https://editor.example.com${path}`), env)).status, 401);
  }
  assert.equal((await handler({ verifyAccess: async () => { throw new Error("Invalid"); } })(request("/"), env)).status, 401);
  assert.equal((await handler({ verifyAccess: async () => ({ sub: "other", email: "other@example.com" }) })(request("/"), env)).status, 403);
  assert.equal((await handler()(new Request("https://unprotected.workers.dev/", { headers: { "Cf-Access-Jwt-Assertion": "x" } }), env)).status, 403);
  assert.equal((await handler()(request("/", { headers: { Origin: "https://evil.example.com" } }), env)).status, 403);
});
test("OAuth usa scope configurado, callback fijo y cookie protegida", async () => {
  const env = environment();
  const { response } = await start(handler(), env);
  const target = new URL(response.headers.get("Location"));
  assert.equal(target.searchParams.get("scope"), "public_repo");
  assert.equal(target.searchParams.get("redirect_uri"), `${env.EDITOR_ORIGIN}/callback`);
  assert.match(response.headers.get("Set-Cookie"), /Secure; HttpOnly; SameSite=Lax/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await handler()(request("/auth?provider=gitlab&site_id=evil.example.com"), env)).status, 400);
});
test("Callback válido entrega protocolo Decap solo al origen fijo y consume state", async () => {
  const env = environment();
  const handle = handler();
  const { state, cookie } = await start(handle, env);
  const callback = request(`/callback?state=${state}&code=test-code`, { headers: { Cookie: cookie } });
  const response = await handle(callback, env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /authorization:github:success/);
  assert.match(html, /event.source!==window.opener/);
  assert.match(html, /https:\/\/editor\.example\.com/);
  assert.ok(!html.includes("test-secret"));
  assert.match(response.headers.get("Content-Security-Policy"), /nonce-/);
  assert.equal((await handle(callback, env)).status, 400);
});
test("State ajeno, caducado y sesión de otra identidad no intercambian código", async () => {
  const env = environment();
  const handle = handler();
  const { state, cookie } = await start(handle, env);
  assert.equal((await handle(request(`/callback?state=${"x".repeat(43)}&code=code`, { headers: { Cookie: cookie } }), env)).status, 400);
  const expired = handler({ now: () => instant + 11 * 60 * 1000, fetch: async () => { throw new Error("No debe llamarse"); } });
  assert.equal((await expired(request(`/callback?state=${state}&code=code`, { headers: { Cookie: cookie } }), env)).status, 400);
  const second = await start(handle, env);
  const other = handler({ verifyAccess: async () => ({ sub: "other-sub", email: env.ACCESS_EMAIL }) });
  assert.equal((await other(request(`/callback?state=${second.state}&code=code`, { headers: { Cookie: second.cookie } }), env)).status, 400);
});
test("Cancelación y errores GitHub son explícitos; usuario y permisos verificados", async () => {
  const cases = [
    { fetch: async () => new Response("Bad", { status: 500 }), expected: 502 },
    { fetch: async () => Response.json({ error: "bad_verification_code" }), expected: 403 },
    { fetch: async (url) => url.includes("access_token") ? Response.json({ token_type: "bearer", access_token: "token" }) : Response.json({ login: "someone-else" }), expected: 403 },
    { fetch: async (url) => url.includes("access_token") ? Response.json({ token_type: "bearer", access_token: "token" }) : url.endsWith("/user") ? Response.json({ login: "AlfonsoRey" }) : Response.json({ full_name: "AlfonsoRey/aula-sexto", permissions: { push: false } }), expected: 403 }
  ];
  for (const scenario of cases) {
    const env = environment();
    const handle = handler(scenario);
    const { state, cookie } = await start(handle, env);
    assert.equal((await handle(request(`/callback?state=${state}&code=code`, { headers: { Cookie: cookie } }), env)).status, scenario.expected);
  }
  const env = environment();
  const handle = handler();
  const { state, cookie } = await start(handle, env);
  const response = await handle(request(`/callback?state=${state}&error=access_denied`, { headers: { Cookie: cookie } }), env);
  assert.match(await response.text(), /authorization:github:error/);
});
test("Un state solo puede consumirse una vez, incluso en concurrencia", async () => {
  const session = new OAuthSessions({ storage: storage() });
  await session.fetch(new Request("https://session/create", { method: "POST", body: JSON.stringify({ sub: "owner", expires: instant + 1000 }) }));
  const responses = await Promise.all([1, 2].map(() => session.fetch(new Request("https://session/consume", { method: "POST" }))));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 410]);
});

import { verifyAccess } from "./access.js";
export { OAuthSessions } from "./sessions.js";

const REPOSITORY = "AlfonsoRey/aula-sexto";
const COOKIE = "__Host-aula-state";
const TTL = 10 * 60 * 1000;
const statePattern = /^[a-zA-Z0-9_-]{43}$/;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
function requireValue(value, code, message, status = 503) {
  if (!value) throw new HttpError(status, code, message);
}
function origin(value) {
  try {
    const parsed = new URL(value);
    requireValue(parsed.protocol === "https:" && parsed.origin === value && !parsed.username && !parsed.password, "configuration", "Configuración del editor incompleta.");
    return parsed.origin;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "configuration", "Configuración del editor incompleta.");
  }
}
export function configuration(env) {
  for (const name of ["EDITOR_ORIGIN", "PUBLIC_ORIGIN", "ACCESS_ISSUER", "ACCESS_AUD", "ACCESS_EMAIL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_LOGIN", "GITHUB_SCOPE"]) {
    requireValue(typeof env[name] === "string" && env[name].trim(), "configuration", "El editor todavía no está configurado.");
  }
  const issuer = origin(env.ACCESS_ISSUER);
  requireValue(new URL(issuer).hostname.endsWith(".cloudflareaccess.com"), "configuration", "Emisor Access no válido.");
  requireValue(env.SESSIONS && env.ASSETS && ["public_repo", "repo"].includes(env.GITHUB_SCOPE), "configuration", "Faltan bindings o permisos válidos.");
  return {
    editor: origin(env.EDITOR_ORIGIN), public: origin(env.PUBLIC_ORIGIN),
    issuer, audience: env.ACCESS_AUD, email: env.ACCESS_EMAIL.toLowerCase(),
    clientId: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET,
    login: env.GITHUB_LOGIN.toLowerCase(), scope: env.GITHUB_SCOPE
  };
}
function cookie(state = "", maxAge = 0) {
  return `${COOKIE}=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function popup(message, editor) {
  const data = JSON.stringify(message).replace(/</g, "\\u003c");
  const target = JSON.stringify(editor);
  const nonce = randomState();
  return new Response(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Autorización del editor</title></head><body><p>Vuelve a la ventana del editor para continuar.</p><script nonce="${nonce}">
const origin=${target};const message=${data};
if(window.opener){
  const receive=(event)=>{
    if(event.origin!==origin||event.source!==window.opener||event.data!=="authorizing:github")return;
    window.removeEventListener("message",receive);
    window.opener.postMessage(message,origin);
    window.close();
  };
  window.addEventListener("message",receive);
  window.opener.postMessage("authorizing:github",origin);
}
</script></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      "Set-Cookie": cookie()
    }
  });
}
function secure(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!headers.has("Content-Security-Policy")) {
    // Decap's bundled Ajv compiles config schemas; Emotion injects styles.
    headers.set("Content-Security-Policy", "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.github.com; frame-src blob:; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
  }
  return new Response(response.body, { status: response.status, headers });
}

export function createHandler(deps = {}) {
  const verify = deps.verifyAccess || verifyAccess;
  const requestGitHub = deps.fetch || fetch;
  const now = deps.now || Date.now;

  async function githubJson(url, options) {
    let response;
    try {
      response = await requestGitHub(url, { ...options, redirect: "error", signal: AbortSignal.timeout(10000) });
    } catch {
      throw new HttpError(502, "github-unavailable", "No se pudo contactar con GitHub. Inicia sesión de nuevo.");
    }
    if (!response.ok) throw new HttpError(502, "github-response", "GitHub no pudo completar la autorización.");
    try {
      return await response.json();
    } catch {
      throw new HttpError(502, "github-format", "GitHub devolvió una respuesta no válida.");
    }
  }
  return async function handle(request, env) {
    try {
      const config = configuration(env);
      const url = new URL(request.url);
      requireValue(url.origin === config.editor, "origin", "Dirección del editor no permitida.", 403);
      const token = request.headers.get("Cf-Access-Jwt-Assertion");
      requireValue(token, "access-missing", "Inicia sesión a través de Cloudflare Access.", 401);
      let identity;
      try {
        identity = await verify(token, config);
      } catch {
        throw new HttpError(401, "access-invalid", "La sesión de Access no es válida o ha caducado.");
      }
      requireValue(typeof identity.sub === "string" && identity.sub && typeof identity.email === "string" && identity.email.toLowerCase() === config.email, "access-denied", "Esta cuenta no tiene acceso al editor.", 403);
      requireValue(request.method === "GET", "method", "Método no permitido.", 405);
      const requestOrigin = request.headers.get("Origin");
      requireValue(!requestOrigin || requestOrigin === config.editor, "origin", "Origen no permitido.", 403);

      if (url.pathname === "/auth") {
        requireValue(url.searchParams.get("provider") === "github" && url.searchParams.get("site_id") === url.hostname, "provider", "Proveedor o sitio de autenticación no válido.", 400);
        const state = randomState();
        const session = env.SESSIONS.get(env.SESSIONS.idFromName(state));
        const result = await session.fetch(new Request("https://session/create", {
          method: "POST",
          body: JSON.stringify({ sub: identity.sub, expires: now() + TTL })
        }));
        requireValue(result.status === 201, "session-store", "No se pudo iniciar la sesión.", 503);
        const target = new URL("https://github.com/login/oauth/authorize");
        target.search = new URLSearchParams({
          client_id: config.clientId, redirect_uri: `${config.editor}/callback`,
          scope: config.scope, state, login: env.GITHUB_LOGIN
        }).toString();
        return secure(new Response(null, { status: 302, headers: { Location: target.href, "Set-Cookie": cookie(state, TTL / 1000) } }));
      }
      if (url.pathname === "/callback") {
        const state = url.searchParams.get("state") || "";
        const saved = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
        requireValue(statePattern.test(state) && state === saved, "state", "La sesión no coincide. Vuelve a iniciar sesión.", 400);
        const session = env.SESSIONS.get(env.SESSIONS.idFromName(state));
        const response = await session.fetch(new Request("https://session/consume", { method: "POST" }));
        requireValue(response.ok, "replay", "La sesión ya se utilizó o ha caducado.", 400);
        const stored = await response.json();
        requireValue(stored.sub === identity.sub && stored.expires > now(), "session", "La sesión ha caducado o pertenece a otra identidad.", 400);
        if (url.searchParams.has("error")) {
          return secure(popup(`authorization:github:error:${JSON.stringify({ message: "Has cancelado el acceso a GitHub. Puedes intentarlo de nuevo." })}`, config.editor));
        }
        const code = url.searchParams.get("code");
        requireValue(code && /^[a-zA-Z0-9_-]{1,512}$/.test(code), "code", "Código de autorización no válido.", 400);
        const result = await githubJson("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, code, redirect_uri: `${config.editor}/callback` }).toString()
        });
        requireValue(typeof result.access_token === "string" && result.access_token && result.token_type?.toLowerCase() === "bearer" && !result.error, "token", "GitHub no ha autorizado la sesión.", 403);
        const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${result.access_token}`, "User-Agent": "aula-sexto-editor", "X-GitHub-Api-Version": "2022-11-28" };
        const user = await githubJson("https://api.github.com/user", { headers });
        requireValue(typeof user.login === "string" && user.login.toLowerCase() === config.login, "github-user", "La cuenta de GitHub no está autorizada.", 403);
        const repository = await githubJson(`https://api.github.com/repos/${REPOSITORY}`, { headers });
        requireValue(repository.full_name?.toLowerCase() === REPOSITORY.toLowerCase() && repository.permissions?.push === true, "github-repository", "La cuenta no tiene permiso de escritura en este repositorio.", 403);
        requireValue(!repository.private || config.scope === "repo", "github-scope", "Un repositorio privado requiere revisar los permisos OAuth.", 403);
        return secure(popup(`authorization:github:success:${JSON.stringify({ token: result.access_token, provider: "github" })}`, config.editor));
      }
      if (url.pathname === "/config.yml") {
        const template = await env.ASSETS.fetch(new Request(`${config.editor}/config.yml`));
        requireValue(template.ok, "config-file", "No se encuentra la configuración del CMS.", 503);
        const yaml = (await template.text()).replaceAll('"__EDITOR_ORIGIN__"', JSON.stringify(config.editor)).replaceAll('"__PUBLIC_ORIGIN__"', JSON.stringify(config.public));
        return secure(new Response(yaml, { headers: { "Content-Type": "text/yaml; charset=utf-8" } }));
      }
      if (url.pathname === "/logout") {
        return secure(new Response(null, { status: 302, headers: { Location: `${config.editor}/logout.html`, "Set-Cookie": cookie() } }));
      }
      const allowed = ["/", "/index.html", "/theme.js", "/styles.css", "/setup.js", "/bootstrap.js", "/logout.html", "/logout.js", "/vendor/decap-cms.js"];
      const vendor = /^\/vendor\/(?:decap-cms\.js|cms\.css|\d+\.decap-cms\.js|[a-f0-9]+\.wasm)$/.test(url.pathname);
      requireValue((allowed.includes(url.pathname) || vendor) && !url.search, "route", "Página no encontrada.", 404);
      const response = await env.ASSETS.fetch(request);
      requireValue(response.ok, "asset", "No se pudo cargar el editor. Revisa su preparación.", 503);
      return secure(response);
    } catch (error) {
      const known = error instanceof HttpError;
      console.error(`Editor: ${known ? error.code : "unexpected-error"}`);
      return secure(new Response(known ? error.message : "Error del editor. Contacta con su responsable.", {
        status: known ? error.status : 500,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": cookie() }
      }));
    }
  };
}

export default { fetch: createHandler() };

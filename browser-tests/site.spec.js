import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHandler } from "../editor/src/worker.js";

async function ready(page) {
  await page.goto("/#/curso/sexto");
  await expect(page.locator("#result-count")).toContainText("43 ejercicios disponibles");
}
test("Pistas progresivas, soluciones ocultas y controles de teclado", async ({ page }) => {
  await ready(page);
  await page.screenshot({ path: test.info().outputPath("aula-desktop.png"), fullPage: true });
  await expect(page.locator(".revealed:visible")).toHaveCount(0);
  const summary = page.locator('[data-topic="calculo"] summary');
  await summary.focus();
  await page.keyboard.press("Enter");
  const card = page.locator('[data-exercise="suma-resta"]');
  const hint = card.locator('button[aria-controls="suma-resta-hints"]');
  await hint.focus();
  await page.keyboard.press("Enter");
  await expect(hint).toHaveAttribute("aria-expanded", "true");
  await expect(card.locator("#suma-resta-hints li")).toHaveCount(1);
  await card.getByRole("button", { name: "Otra pista" }).click();
  await expect(card.locator("#suma-resta-hints li")).toHaveCount(2);
  await card.getByRole("button", { name: "Ver solución:" }).click();
  await expect(card.locator("#suma-resta-solution")).toContainText("55 649");
  await page.getByLabel("¿Qué quieres practicar?").fill("suma");
  await expect(page.locator(".revealed:visible")).toHaveCount(0);
});
test("Filtros combinados, acentos y estado vacío sin perder foco", async ({ page }) => {
  await ready(page);
  const search = page.getByLabel("¿Qué quieres practicar?");
  await search.fill("triangulo");
  await page.getByLabel("Tema", { exact: true }).selectOption("geometria");
  await page.getByLabel("Dificultad", { exact: true }).selectOption("intermedio");
  await expect(page.locator(".exercise")).toHaveCount(1);
  await expect(page.locator(".exercise h4")).toHaveText("La mitad de un rectángulo");
  await search.fill("esto-no-existe");
  await expect(search).toBeFocused();
  await expect(page.getByRole("status")).toContainText("0 ejercicios");
  await expect(page.getByRole("button", { name: "Imprimir ejercicios" })).toBeDisabled();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.locator(".exercise")).toHaveCount(43);
});
test("Impresión independiente: incluye plegados y nunca pistas ni soluciones abiertas", async ({ page }) => {
  await ready(page);
  await page.getByLabel("Tema", { exact: true }).selectOption("fracciones");
  await page.locator('[data-exercise="fraccion-cantidad"]').getByRole("button", { name: "Ver solución:" }).click();
  await page.locator('[data-exercise="fraccion-cantidad"]').getByRole("button", { name: "Ver pista:" }).click();
  await page.locator('[data-topic="fracciones"] summary').click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#screen-view")).toBeHidden();
  await expect(page.locator("#print-view")).toBeVisible();
  await expect(page.locator("#print-view .print-exercise")).toHaveCount(4);
  const printed = await page.locator("#print-view").innerText();
  expect(printed).toContain("Calcula 3/4 de 280");
  expect(printed).not.toContain("son 210");
  expect(printed).not.toContain("El denominador indica");
  expect(printed).not.toContain("7/10");
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.length).toBeGreaterThan(1000);
});
for (const width of [320, 390, 768, 1280]) {
  test(`Sin desbordamiento y objetivos táctiles a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    await page.getByLabel("Tema", { exact: true }).selectOption("datos");
    if (width === 390) await page.screenshot({ path: test.info().outputPath("aula-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sizes = await page.locator("button:visible, input:visible, select:visible, summary:visible").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(sizes.every((height) => height >= 44)).toBe(true);
  });
}
test("Sin cuentas, trackers, persistencia ni peticiones a terceros", async ({ page }) => {
  const origins = new Set();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await ready(page);
  expect([...origins]).toEqual(["http://127.0.0.1:4173"]);
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await expect(page.locator("#course-screen .independence")).toBeVisible();
});
test("Error de contenido explícito y reintento real", async ({ page }) => {
  let fail = true;
  await page.route("**/data/matematicas/calculo.json", async (route) => {
    if (fail) await route.fulfill({ status: 500, body: "error" });
    else await route.continue();
  });
  await page.goto("/#/curso/sexto");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".exercise")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(page.locator("#result-count")).toContainText("43 ejercicios");
  await expect(page.getByRole("alert")).toBeHidden();
});
test("JSON inválido no se presenta como resultado vacío", async ({ page }) => {
  await page.route("**/data/matematicas/calculo.json", (route) => route.fulfill({ json: { topic: "calculo", exercises: [] } }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#catalog-status")).toContainText("no están disponibles");
});
test("Tema oscuro y zoom de contenido al 200 % mantienen legibilidad", async ({ page }) => {
  await page.goto("/?scoutTheme=dark#/curso/sexto");
  await expect(page.locator("#result-count")).toContainText("43 ejercicios");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await page.getByLabel("Tema", { exact: true }).selectOption("logica");
  expect(await page.locator("#search").evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(88);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const pairs = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["--cp-bg", "--cp-bg-elevated", "--cp-surface"].map((background) => ({
      text: style.getPropertyValue("--cp-text-muted").trim(),
      background: style.getPropertyValue(background).trim()
    }));
  });
  function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }
  for (const pair of pairs) {
    const a = luminance(pair.text), b = luminance(pair.background);
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
  }
});
test("Portada por cursos y pantallas independientes con Atrás y enlaces directos", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#catalog-status")).toContainText("3 cursos");
    await page.screenshot({ path: test.info().outputPath("courses-home.png"), fullPage: true });
    await expect(page.locator("#course-screen")).toBeHidden();
    await expect(page.locator(".exercise")).toHaveCount(0);
    const sixth = page.getByRole("link", { name: "Entrar en 6.º de Primaria" });
    await sixth.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/curso\/sexto$/);
    await expect(page.locator("#course-title")).toBeFocused();
    await expect(page.locator("#course-title")).toHaveText("6.º de Primaria");
    await expect(page.locator(".exercise")).toHaveCount(43);
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    await expect(page).toHaveURL(/#\/curso\/sexto$/);
    await page.getByLabel("¿Qué quieres practicar?").fill("sendero");
    await expect(page.locator(".exercise")).toHaveCount(1);
    await page.getByRole("link", { name: "Elegir otro curso" }).click();
    await expect(page.locator("#print-view .print-exercise")).toHaveCount(0);
    await page.getByRole("link", { name: "Entrar en 3.º de Primaria" }).click();
    await expect(page.locator("#course-title")).toHaveText("3.º de Primaria");
    await expect(page.locator(".exercise")).toHaveCount(20);
    await expect(page.locator('[data-exercise="suma-resta"]')).toHaveCount(0);
    await expect(page.getByLabel("¿Qué quieres practicar?")).toHaveValue("");
    await page.reload();
    await expect(page.locator("#result-count")).toContainText("20 ejercicios");
    await page.goBack();
    await expect(page.locator("#home-screen")).toBeVisible();
    await page.goto("/#/curso/no-existe");
    await expect(page.getByRole("alert")).toContainText("No encontramos ese curso");
    await expect(page.locator(".exercise")).toHaveCount(0);
  });
  test("Tercero: filtros y hoja impresa no incluyen contenido de sexto ni respuestas", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/#/curso/tercero");
    await expect(page.locator("#result-count")).toContainText("20 ejercicios");
    await page.getByLabel("Tema", { exact: true }).selectOption("formas-datos-tercero");
    await page.getByLabel("¿Qué quieres practicar?").fill("tabla");
    await expect(page.locator(".exercise")).toHaveCount(1);
    await page.getByRole("button", { name: "Ver solución:" }).click();
    await page.screenshot({ path: test.info().outputPath("third-mobile.png"), fullPage: true });
    await expect(page.locator("#print-view .print-exercise")).toHaveCount(1);
    expect(await page.locator("#print-view").textContent()).not.toContain("Hay 20 votos");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#print-view h1")).toContainText("3.º de Primaria");
    await expect(page.locator("#print-view")).toContainText("Manzana");
    expect(await page.locator("#print-view").textContent()).not.toContain("6.º");
  });
test("Bachillerato: fuentes verificables, materias aisladas y sin respuestas inventadas", async ({ page }) => {
  const origins = new Set();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/#/curso/bachillerato-galicia");
  await expect(page.locator("#course-title")).toHaveText("1.º de Bachillerato");
  await expect(page.locator("#course-region")).toHaveText("Tu curso · Galicia");
  await expect(page.locator("#header-note")).toContainText("Galicia");
  await expect(page.locator("#result-count")).toContainText("0 ejercicios disponibles. 1 documento externo");
  await expect(page.locator("[data-exercise]")).toHaveCount(0);
  await expect(page.locator("[data-resource]")).toHaveCount(1);
  await expect(page.getByLabel("Dificultad", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Imprimir ejercicios" })).toBeDisabled();
  await expect(page.locator("#print-view")).toBeEmpty();
  await expect(page.locator("#resource-note")).toContainText("no todo el temario ni exámenes oficiales");
  await page.getByLabel("¿Qué quieres practicar?").fill("triángulos");
  const maths = page.locator('[data-resource="bach-matematicas-cuaderno-refuerzo"]');
  await expect(maths).toContainText("no examen oficial");
  const link = maths.getByRole("link", { name: "Abrir PDF original:" });
  await expect(link).toHaveAttribute("href", /PENDIENTES%20MATEM%C3%81TICAS%20I_0.pdf$/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(maths.getByRole("button")).toHaveCount(0);
  await page.locator('button[data-subject="fisica-bachillerato"]').click();
  await expect(page.locator("[data-resource]")).toHaveCount(2);
  await expect(page.locator("#result-count")).toContainText("2 documentos externos");
  await expect(page.getByLabel("¿Qué quieres practicar?")).toHaveValue("");
  await page.getByLabel("¿Qué quieres practicar?").fill("velocidad");
  await expect(page.locator("[data-resource]")).toHaveCount(2);
  await expect(page.locator("#results")).toContainText("04/07/2013");
  await expect(page.locator("#results")).toContainText("Gallego");
  await expect(page.locator("#results")).toContainText("Creative Commons BY-NC-SA");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect([...origins]).toEqual(["http://127.0.0.1:4173"]);
  await page.getByLabel("¿Qué quieres practicar?").fill("ningún-documento");
  await expect(page.locator("[data-resource]")).toHaveCount(0);
  await expect(page.locator("#results")).toContainText("No hay ejercicios ni documentos");
  await page.getByRole("link", { name: "Elegir otro curso" }).click();
  await page.getByRole("link", { name: "Entrar en 6.º de Primaria" }).click();
  await expect(page.locator("#course-region")).toContainText("Comunidad de Madrid");
  await expect(page.getByLabel("Dificultad", { exact: true })).toBeEnabled();
  await expect(page.locator("#resource-note")).toBeHidden();
  await expect(page.locator("[data-resource]")).toHaveCount(0);
  await expect(page.locator("[data-exercise]")).toHaveCount(43);
  await expect(page.locator("#print-view .print-exercise")).toHaveCount(43);
});

test("Fuente externa inválida provoca error explícito y no catálogo parcial", async ({ page }) => {
  await page.route("**/data/fisica-bachillerato/cinematica-bachillerato.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.resources[0].source.url = "javascript:alert(1)";
    await route.fulfill({ json: data });
  });
  await page.goto("/#/curso/bachillerato-galicia");
  await expect(page.getByRole("alert")).toContainText("contenido válido");
  await expect(page.locator("[data-resource], [data-exercise]")).toHaveCount(0);
});

test("Decap carga configuración local sin autorizar ni guardar en GitHub", async ({ page }) => {
  const root = new URL("../editor/assets/", import.meta.url);
  const env = {
    EDITOR_ORIGIN: "https://editor.example.com", PUBLIC_ORIGIN: "https://aula.example.com",
    ACCESS_ISSUER: "https://team.cloudflareaccess.com", ACCESS_AUD: "audience", ACCESS_EMAIL: "editor@example.com",
    GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret", GITHUB_LOGIN: "AlfonsoRey", GITHUB_SCOPE: "public_repo",
    SESSIONS: {},
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        try {
          const body = await readFile(new URL(path, root));
          const type = path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".yml") ? "text/yaml" : path.endsWith(".wasm") ? "application/wasm" : "text/html";
          return new Response(body, { headers: { "Content-Type": type } });
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          return new Response(null, { status: 404 });
        }
      }
    }
  };
  const handle = createHandler({ verifyAccess: async () => ({ sub: "test-owner", email: env.ACCESS_EMAIL }) });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== env.EDITOR_ORIGIN) return route.abort();
    const response = await handle(new Request(route.request().url(), { headers: { "Cf-Access-Jwt-Assertion": "test-jwt" } }), env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) errors.push(message.text());
  });
  await page.goto(env.EDITOR_ORIGIN);
  await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

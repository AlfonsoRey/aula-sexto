import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const dependency = new URL("node_modules/decap-cms/", root);
const assets = new URL("editor/assets/", root);
const info = JSON.parse(await readFile(new URL("package.json", dependency), "utf8"));
if (info.version !== "3.16.3") throw new Error("Versión de Decap no aprobada.");
await mkdir(new URL("vendor/", assets), { recursive: true });
const dist = new URL("dist/", dependency);
for (const name of await readdir(dist)) {
  if (name === "decap-cms.js" || /^\d+\.decap-cms\.js$/.test(name) || name.endsWith(".wasm") || name === "cms.css" || name === "decap-cms.js.LICENSE.txt") {
    await copyFile(new URL(name, dist), new URL(`vendor/${name}`, assets));
  }
}
await copyFile(new URL("public/assets/theme.js", root), new URL("theme.js", assets));
await copyFile(new URL("public/assets/styles.css", root), new URL("styles.css", assets));
const hash = createHash("sha256").update(await readFile(new URL("vendor/decap-cms.js", assets))).digest("hex");
console.log(`Decap ${info.version} preparado en ${fileURLToPath(assets)}; SHA-256 ${hash}. Sin despliegue.`);

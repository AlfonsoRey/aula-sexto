import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const headerLines = (await readFile(resolve(root, "_headers"), "utf8")).split(/\r?\n/);
function siteHeaders(pathname) {
  const headers = {};
  let applies = false;
  for (const line of headerLines) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) {
      applies = line === "/*" || (line.endsWith("*") && pathname.startsWith(line.slice(0, -1)));
    } else if (applies) {
      const separator = line.indexOf(":");
      headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  return headers;
}
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filename = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : root + sep) || !types[extname(filename)]) {
      response.writeHead(404).end("No encontrado");
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, { ...siteHeaders(pathname), "Content-Type": types[extname(filename)], "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : await readFile(resolve(root, "404.html")));
    } else {
      console.error("Error del servidor local:", error);
      response.writeHead(500).end("Error del servidor local");
    }
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Aula sexto: http://127.0.0.1:${port}`));

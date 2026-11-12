const { randomInt } = require("node:crypto");
const { realpath } = require("node:fs/promises");
const { isAbsolute, relative, resolve, sep } = require("node:path");

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const publicDir = process.env.PUBLIC_DIR
  ? resolve(process.cwd(), process.env.PUBLIC_DIR)
  : null;

function configuredBaseUrl() {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const configured =
    process.env.BASE_URL ||
    (railwayDomain
      ? /^[a-z][a-z\d+.-]*:\/\//i.test(railwayDomain)
        ? railwayDomain
        : `https://${railwayDomain}`
      : "http://localhost:3000");

  try {
    return new URL(configured).origin;
  } catch {
    throw new Error("BASE_URL or RAILWAY_PUBLIC_DOMAIN must be a valid URL or hostname");
  }
}

const baseUrl = configuredBaseUrl();

function json(body, status = 200) {
  return Response.json(body, { status });
}

function codeForNewLink() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (links.has(code));
  return code;
}

function cors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Expose-Headers", "Location");
  return response;
}

async function serveStatic(pathname) {
  if (!publicDir) return null;

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return null;
  }
  if (relativePath.includes("\0")) return null;

  const filePath = resolve(publicDir, `.${relativePath}`);
  const pathFromPublicDir = relative(publicDir, filePath);
  if (
    pathFromPublicDir === ".." ||
    pathFromPublicDir.startsWith(`..${sep}`) ||
    isAbsolute(pathFromPublicDir)
  ) {
    return null;
  }

  let realPublicDir;
  let realFilePath;
  try {
    [realPublicDir, realFilePath] = await Promise.all([
      realpath(publicDir),
      realpath(filePath),
    ]);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }

  const realPathFromPublicDir = relative(realPublicDir, realFilePath);
  if (
    realPathFromPublicDir === ".." ||
    realPathFromPublicDir.startsWith(`..${sep}`) ||
    isAbsolute(realPathFromPublicDir)
  ) {
    return null;
  }

  return new Response(Bun.file(realFilePath));
}

async function handle(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method === "POST" && pathname === "/api/links") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }

    if (typeof body?.url !== "string") {
      return json({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    let originalUrl;
    try {
      originalUrl = new URL(body.url);
    } catch {
      return json({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    if (
      !["http:", "https:"].includes(originalUrl.protocol) ||
      !originalUrl.hostname
    ) {
      return json({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    const code = codeForNewLink();
    const link = {
      code,
      url: originalUrl.href,
      shortUrl: `${baseUrl}/${code}`,
      hits: 0,
      createdAt: new Date().toISOString(),
    };
    links.set(code, link);
    return json(link, 201);
  }

  if (request.method === "GET" && pathname === "/api/links") {
    return json(Array.from(links.values()));
  }

  if (request.method === "GET") {
    const staticResponse = await serveStatic(pathname);
    if (staticResponse) return staticResponse;

    const code = pathname.startsWith("/") ? pathname.slice(1) : "";
    const link = links.get(code);
    if (link) {
      link.hits += 1;
      return new Response(null, {
        status: 302,
        headers: { Location: link.url },
      });
    }
  }

  return json({ error: "Not found" }, 404);
}

Bun.serve({
  port,
  fetch: async (request) => cors(await handle(request)),
});

console.log(`Snip backend listening on http://localhost:${port}`);

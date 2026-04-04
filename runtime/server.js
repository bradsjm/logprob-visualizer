import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const HELP_TEXT = `Usage: npx @bradsjm/logprobs-viewer [options]

Options:
  --host <address>  Host to bind the static server (default: 127.0.0.1)
  --port <number>   Port to bind the static server (default: 8080)
  --no-open         Do not open the browser automatically
  --help            Show this help text
`;

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
}

function getCacheControl(requestPath) {
  if (requestPath === "/" || requestPath.endsWith(".html")) {
    return "no-cache";
  }

  if (requestPath.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

async function loadResponseBody(filePath) {
  return readFile(filePath);
}

async function resolveRequestFile(distDir, requestPath) {
  const requestFilePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = path.normalize(requestFilePath).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = path.resolve(distDir, `.${normalizedPath}`);

  if (candidatePath === distDir || isPathInside(distDir, candidatePath)) {
    try {
      return {
        body: await loadResponseBody(candidatePath),
        filePath: candidatePath,
        statusCode: 200,
      };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (path.extname(requestPath) !== "") {
    return {
      body: Buffer.from("Not Found"),
      filePath: null,
      statusCode: 404,
    };
  }

  const indexFilePath = path.join(distDir, "index.html");
  return {
    body: await loadResponseBody(indexFilePath),
    filePath: indexFilePath,
    statusCode: 200,
  };
}

export function parseCliArgs(argv) {
  const options = {
    host: DEFAULT_HOST,
    openBrowser: true,
    port: DEFAULT_PORT,
    showHelp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      options.showHelp = true;
      continue;
    }

    if (arg === "--no-open") {
      options.openBrowser = false;
      continue;
    }

    if (arg === "--host") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --host.");
      }

      options.host = nextArg;
      index += 1;
      continue;
    }

    if (arg === "--port") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --port.");
      }

      const port = Number.parseInt(nextArg, 10);
      if (Number.isNaN(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid port: ${nextArg}`);
      }

      options.port = port;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function formatHelpText() {
  return HELP_TEXT;
}

export function maybeOpenBrowser(url) {
  const openCommand =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const child = spawn(openCommand[0], openCommand.slice(1), {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function createRequestHandler(distDir = DIST_DIR) {
  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    try {
      const result = await resolveRequestFile(distDir, requestUrl.pathname);
      const contentType =
        result.filePath === null ? "text/plain; charset=utf-8" : getContentType(result.filePath);
      const headers = {
        "Cache-Control": getCacheControl(requestUrl.pathname),
        "Content-Type": contentType,
      };

      response.writeHead(result.statusCode, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }

      response.end(result.body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(
        error instanceof Error ? error.message : "Unexpected static server error.",
      );
    }
  };
}

export async function startServer({
  distDir = DIST_DIR,
  host = DEFAULT_HOST,
  openBrowser = true,
  port = DEFAULT_PORT,
} = {}) {
  const server = createServer(createRequestHandler(distDir));

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine the listening address.");
  }

  const displayHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const url = `http://${displayHost}:${address.port}`;

  let browserOpened = false;
  if (openBrowser) {
    browserOpened = maybeOpenBrowser(url);
  }

  return {
    browserOpened,
    host,
    port: address.port,
    server,
    url,
  };
}

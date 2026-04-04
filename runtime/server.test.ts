// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createRequestHandler, parseCliArgs, startServer } from "./server.js";

async function createFixtureDist() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "logprob-visualizer-"));
  await mkdir(path.join(tempDir, "assets"), { recursive: true });
  await writeFile(
    path.join(tempDir, "index.html"),
    "<!doctype html><html><body><div id='root'>fixture</div></body></html>",
  );
  await writeFile(path.join(tempDir, "assets", "app.js"), "console.log('fixture');");
  await writeFile(path.join(tempDir, "favicon.svg"), "<svg></svg>");
  return tempDir;
}

describe("parseCliArgs", () => {
  it("parses host, port, and browser flags", () => {
    expect(parseCliArgs(["--host", "0.0.0.0", "--port", "9090", "--no-open"])).toEqual({
      host: "0.0.0.0",
      openBrowser: false,
      port: 9090,
      showHelp: false,
    });
  });

  it("supports help mode", () => {
    expect(parseCliArgs(["--help"])).toEqual({
      host: "127.0.0.1",
      openBrowser: true,
      port: 8080,
      showHelp: true,
    });
  });
});

describe("static server", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = null;
    }
  });

  it("serves the SPA shell, assets, and route fallbacks", async () => {
    tempDir = await createFixtureDist();
    const { server, url } = await startServer({
      distDir: tempDir,
      host: "127.0.0.1",
      openBrowser: false,
      port: 0,
    });

    try {
      const indexResponse = await fetch(`${url}/`);
      expect(indexResponse.status).toBe(200);
      expect(indexResponse.headers.get("content-type")).toContain("text/html");
      await expect(indexResponse.text()).resolves.toContain("fixture");

      const assetResponse = await fetch(`${url}/assets/app.js`);
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      await expect(assetResponse.text()).resolves.toContain("fixture");

      const routeResponse = await fetch(`${url}/playground`);
      expect(routeResponse.status).toBe(200);
      await expect(routeResponse.text()).resolves.toContain("fixture");

      const missingAssetResponse = await fetch(`${url}/assets/missing.js`);
      expect(missingAssetResponse.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("rejects non-get methods", async () => {
    tempDir = await createFixtureDist();
    const handler = createRequestHandler(tempDir);
    const server = await new Promise<Server>((resolve) => {
      const nextServer = createServer(handler);
      nextServer.listen(0, "127.0.0.1", () => resolve(nextServer));
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Missing test address.");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/`, {
        method: "POST",
      });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});

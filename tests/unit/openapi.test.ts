import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve("src/app/api");

// Endpoints whose contract is someone else's: Better Auth's own API, and the MCP transport's GET/DELETE
// (session plumbing next to the documented POST).
const NOT_IN_CONTRACT = new Set([
  "GET /api/mcp",
  "DELETE /api/mcp",
  "GET /api/mcp/guest",
  "DELETE /api/mcp/guest",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(file);
    return entry.name === "route.ts" ? [file] : [];
  });
}

function implementedOperations(): string[] {
  return routeFiles(API_DIR).flatMap((file) => {
    const urlPath = `/api/${path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/")}`.replace(
      /\[([^\]]+)\]/g,
      "{$1}",
    );
    if (urlPath.includes("{...")) return [];
    const methods = readFileSync(file, "utf8").matchAll(
      /export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g,
    );
    return [...methods].map(([, method]) => `${method} ${urlPath}`);
  });
}

describe("OpenAPI contract", () => {
  it("documents every API route the app implements", () => {
    const spec = JSON.parse(readFileSync("docs/openapi.json", "utf8")) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const documented = new Set(
      Object.entries(spec.paths).flatMap(([urlPath, operations]) =>
        Object.keys(operations).map((method) => `${method.toUpperCase()} ${urlPath}`),
      ),
    );
    const missing = implementedOperations().filter((op) => !documented.has(op) && !NOT_IN_CONTRACT.has(op));
    expect(missing).toEqual([]);
  });
});

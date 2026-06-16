#!/usr/bin/env node
/**
 * Copyright 2026 熊高锐
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, resolve as resolvePath } from "path";

// ── Resolve database path ────────────────────────────────

const DB_PATH = process.env.COGNITION_DB_PATH ?? join(homedir(), ".cognition", "dev.db");

function resolveDbPath(): string {
  const dir = DB_PATH.replace(/[/\\][^/\\]+$/, "");
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch { /* ok */ }
  }
  return DB_PATH;
}

function ensureDatabase(): void {
  const dbFile = resolveDbPath();
  if (existsSync(dbFile)) return;

  console.error("\ud83d\udd27 Initializing cognition database...");

  const prismaSchema = join(import.meta.dirname, "..", "prisma", "schema.prisma");
  if (!existsSync(prismaSchema)) {
    console.error("Warning: prisma/schema.prisma not found — skipping auto-init");
    return;
  }

  process.env.DATABASE_URL = `file:${dbFile}`;
  try {
    execSync("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "inherit",
    });
    console.error("\u2705 Database initialized at", dbFile);
  } catch (err) {
    console.error("\u2757 Database auto-init failed:", String(err));
    console.error("You can run manually: npx prisma db push --skip-generate");
  }
}

// ── Run server ────────────────────────────────────────────

ensureDatabase();

// Set env for the Prisma client used by the server
process.env.DATABASE_URL = `file:${resolveDbPath()}`;

// ── Lazy Prisma Client generation fallback ─────────────────
// If postinstall was skipped (e.g. CI with --ignore-scripts),
// generate the Prisma client on first run so the import succeeds.
// Uses stdio: "pipe" to avoid polluting the MCP JSON-RPC stdout channel.
try {
  const prismaClientEntry = resolvePath(import.meta.dirname!, "..", "node_modules", ".prisma", "client", "index.js");
  if (!existsSync(prismaClientEntry.replace(/\\/g, "/"))) {
    throw new Error("Prisma client not generated");
  }
} catch {
  console.error("[mcp-cognition-engine] Prisma client not found — running generate...");
  try {
    execSync("npx prisma generate", {
      cwd: resolvePath(import.meta.dirname!, ".."),
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });
    console.error("[mcp-cognition-engine] Prisma client generated successfully");
  } catch (err) {
    console.error("[mcp-cognition-engine] Failed to generate Prisma client:", String(err));
    process.exit(1);
  }
}

// Now import and run the full server (same as src/index.ts but with
// DATABASE_URL already set)
import("./index.js").catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

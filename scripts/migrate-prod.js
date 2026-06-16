#!/usr/bin/env node
/**
 * Production Migration Script — Windows (PowerShell-compatible)
 *
 * Usage:
 *   node scripts/migrate-prod.js
 *
 * Runs prisma migrate deploy (safe, no data loss) for production databases.
 * Use this when deploying to prod — never use db push in production.
 */

const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve, join } = require("node:path");

const projectRoot = resolve(__dirname, "..");
const schemaPath = join(projectRoot, "prisma", "schema.prisma");

if (!existsSync(schemaPath)) {
  console.error("Error: prisma/schema.prisma not found at", schemaPath);
  process.exit(1);
}

console.log("Running prisma migrate deploy...");
try {
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "file:./prisma/prod.db" },
    stdio: "inherit",
  });
  console.log("Migration complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}

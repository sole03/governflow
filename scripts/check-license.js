/**
 * License header checker for Apache 2.0 compliance.
 * Scans all .ts files under src/ and tests/, verifies header presence.
 * Exit code 0 = all OK, 1 = missing headers.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const TARGET_DIRS = ["src", "tests"];
const HEADER_CHECK = "/**\n * Copyright 2026 熊高锐";

function scanFiles(dir, results) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      scanFiles(full, results);
    } else if (e.isFile() && e.name.endsWith(".ts")) {
      results.push(full);
    }
  }
}

const files = [];
for (const d of TARGET_DIRS) scanFiles(d, files);

let missing = 0;
for (const f of files) {
  const content = readFileSync(f, "utf-8");
  if (!content.startsWith(HEADER_CHECK)) {
    console.log("MISSING HEADER:", f);
    missing++;
  }
}

if (missing === 0) {
  console.log("All files have valid license headers.");
  process.exit(0);
} else {
  console.log("FAILED:", missing, "file(s) missing license headers");
  process.exit(1);
}

#!/usr/bin/env node
/**
 * VM-compatible prepack hook.
 *
 * On this Windows VM, npm's tar module fails with "encountered unexpected EOF"
 * when reading from the project ROOT directory (D:/Desktop/mcp/).
 * It works fine from any subdirectory on the same drive.
 *
 * This script:
 *   1. Copies the package into .pkg-work/ (same drive, one level deeper)
 *   2. Runs `npm pack` from there
 *   3. Moves the resulting .tgz up to the project root
 *   4. Cleans up .pkg-work/
 *
 * On real machines, this is equivalent to `npm pack` from root.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const WORK = join(ROOT, ".pkg-work");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const TGZ_NAME = `${PKG.name}-${PKG.version}.tgz`;

function tryRm(p) { try { rmSync(p, { recursive: true, force: true }); } catch {} }

// Step 1: Create work directory
tryRm(WORK);
mkdirSync(WORK, { recursive: true });

// Step 2: Copy package files into work directory
const toCopy = ["package.json", "README.md", "LICENSE"];
if (existsSync(join(ROOT, ".env.example"))) toCopy.push(".env.example");
for (const pattern of PKG.files || []) {
  // patterns like "dist", "prisma/schema.prisma", "docs/"
  const src = join(ROOT, pattern);
  const dst = join(WORK, pattern);
  if (existsSync(src)) {
    tryRm(dst);
    const dstDir = dst.includes("/") || dst.includes("\\") ? dst.replace(/[/\\][^/\\]+$/, "") : dst;
    if (dstDir !== dst) mkdirSync(dstDir, { recursive: true });
    cpSync(src, dst, { recursive: true });
  }
}

// Step 3: Write a clean package.json into work dir (strip scripts.prepack to avoid recursion)
const cleanPkg = { ...PKG };
// Remove lifecycle hooks that would recurse
delete cleanPkg.scripts?.prepack;
delete cleanPkg.scripts?.prepare;
writeFileSync(join(WORK, "package.json"), JSON.stringify(cleanPkg, null, 2) + "\n");

// Step 4: Run npm pack from work directory
const DRY_RUN = process.argv.includes("--dry-run");
try {
  if (DRY_RUN) {
    const out = execSync("npm pack --dry-run", { cwd: WORK, encoding: "utf-8", stdio: "pipe", timeout: 60_000 });
    console.log(out.trim());
  } else {
    console.log("[prepack] Packaging from .pkg-work/ ...");
    execSync("npm pack --pack-destination ..", { cwd: WORK, stdio: "pipe", timeout: 60_000 });
    const tgzPath = join(ROOT, TGZ_NAME);
    // npm pack in work dir with --pack-destination .. puts tgz in ROOT, not ROOT/..
    // Actually --pack-destination .. from WORK means ROOT
    const actualTgz = join(ROOT, TGZ_NAME);
    if (existsSync(actualTgz)) {
      console.log(`[prepack] ${TGZ_NAME} ready`);
    }
  }
} catch (e) {
  const err = e.stderr?.toString() ?? e.message ?? "";
  console.error("[prepack] pack failed:", err.slice(0, 500));
  process.exit(1);
} finally {
  // Step 5: Cleanup
  tryRm(WORK);
}

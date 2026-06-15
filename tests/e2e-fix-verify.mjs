import D from "better-sqlite3";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join, dirname, resolve } from "path";
import { unlinkSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Default: derive from DATABASE_URL env, fallback to project-relative path
let dbPath;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("file:")) {
  dbPath = resolve(projectRoot, process.env.DATABASE_URL.slice("file:".length));
} else if (process.env.DATABASE_URL) {
  dbPath = resolve(projectRoot, process.env.DATABASE_URL);
} else {
  dbPath = resolve(projectRoot, "prisma/data/rules.db");
}
let tmpMode = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--db" && i + 1 < process.argv.length) {
    dbPath = process.argv[i + 1];
    tmpMode = dbPath === ":memory:";
    break;
  }
}

const r = { fixes: {}, meta: { ec: 0, ts: new Date().toISOString(), db: dbPath } };

if (tmpMode) {
  dbPath = join(tmpdir(), "mcp-e2e-" + Date.now() + ".db");
  execSync("npx prisma db push --skip-generate", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: "file:" + dbPath },
    stdio: "pipe",
  });
  // Ensure tmp directory exists before opening
  const tmpDir = dirname(dbPath);
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const d = new D(dbPath);
  const now = new Date().toISOString();
  for (const s of [
    {sc:"project",tp:"replace",pa:"console.log",su:"console.error",la:"typescript",ex:null,ta:"debug,logging"},
    {sc:"project",tp:"replace",pa:"oldApi",su:"newApi",la:"typescript",ex:".ts",ta:"api"},
    {sc:"global",tp:"convention",pa:"TODO:",su:"FIXME:",la:"javascript",ex:null,ta:null},
    {sc:"user",tp:"replace",pa:"var ",su:"const ",la:"javascript",ex:".js",ta:"style"},
  ]) {
    d.prepare("INSERT INTO Rule (id,scope,type,pattern,suggestion,language,fileExtensions,tags,confidence,source,status,createdAt) VALUES(?,?,?,?,?,?,?,?,'high','auto','active',?)").run(randomUUID(),s.sc,s.tp,s.pa,s.su,s.la,s.ex,s.ta,now);
  }
  d.close();
}

// Ensure database directory exists before opening (CI may not have prisma/data/)
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const d = new D(dbPath);
let ec = 0;
r.meta.db = dbPath;
try {
  const t = d.prepare("SELECT COUNT(*) as c FROM Rule").get();
  r.fixes.rulesExist = { pass: t.c > 0, val: t.c };
  const m = d.prepare("SELECT COUNT(*) as c FROM Rule WHERE status='active' AND (language='*' OR language='typescript') AND (fileExtensions IS NULL OR fileExtensions LIKE '%ts%')").get();
  r.fixes.queryByMatch = { pass: m.c > 0, val: m.c };
  const s = d.prepare("SELECT scope, COUNT(*) as c FROM Rule GROUP BY scope").all();
  r.fixes.scopeDist = { pass: s.length > 0, val: s };
  const vt = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='RuleVersion'").get();
  r.fixes.versionAudit = { pass: vt !== undefined, val: vt ? vt.name : null };
  d.close();
  if (tmpMode) {
    try { unlinkSync(dbPath); unlinkSync(dbPath + "-wal"); unlinkSync(dbPath + "-shm"); } catch {}
  }
} catch(e) {
  try { d.close(); } catch {}
  r.meta.err = e.message; ec = 1;
}
r.meta.ec = ec;
console.log(JSON.stringify(r, null, 2));
process.exit(ec);

# Agent 调教反向图谱系统 — 核心引擎 + MCP Server 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可运行的 Cursor MCP Server，实现代码修改的静默捕获、AST Diff 分析、规则生成/存储/检索与冲突仲裁，完成 MVP 核心闭环。

**Architecture:** 四层分离架构 — MCP 工具层 (tools/) 接收 Cursor 请求 → 引擎层 (engine/) 执行业务逻辑（AST Diff / 规则匹配）→ 存储层 (storage/) 通过 Prisma + SQLite 持久化 → 仲裁层 (conflict/) 处理规则冲突。双模式（静默/确认）通过 modes/ 控制交互密度。

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk v0.6, Prisma ORM + SQLite, web-tree-sitter (WASM), vitest

---

## 文件结构

```
D:\Desktop\mcp\
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts                  # MCP Server 入口 + 工具注册
│   ├── types.ts                  # 共享类型定义
│   ├── tools/
│   │   ├── capture-diff.ts       # capture_diff 工具处理
│   │   ├── query-rules.ts        # query_rules 工具处理
│   │   ├── confirm-rule.ts       # confirm_rule 工具处理
│   │   ├── resolve-conflict.ts   # resolve_conflict 工具处理
│   │   └── list-rules.ts         # list_rules 工具处理
│   ├── engine/
│   │   ├── ast-node.ts           # AST 节点类型 + 签名生成
│   │   ├── ast-diff.ts           # 核心 Diff 算法（签名映射 + 编辑距离）
│   │   ├── parsers.ts            # Tree-sitter 解析器 + 正则降级
│   │   ├── rule-generator.ts     # 规则候选生成 + 阈值逻辑
│   │   ├── rule-matcher.ts       # 确定性匹配 + 加权打分 + Top-K
│   │   └── token-controller.ts   # Token 预算控制 (≤2000)
│   ├── storage/
│   │   ├── client.ts             # Prisma 客户端
│   │   ├── rule-repo.ts          # 规则仓库
│   │   ├── diff-log-repo.ts      # Diff 日志仓库
│   │   ├── conflict-repo.ts      # 冲突记录仓库
│   │   └── metric-repo.ts        # 指标埋点仓库
│   ├── modes/
│   │   ├── silent.ts             # 静默模式
│   │   └── confirm.ts            # 确认模式
│   └── conflict/
│       └── arbitrator.ts         # 冲突检测 + 仲裁
└── tests/
    ├── engine/
    │   ├── ast-diff.test.ts
    │   ├── rule-generator.test.ts
    │   ├── rule-matcher.test.ts
    │   └── token-controller.test.ts
    ├── tools/
    │   ├── capture-diff.test.ts
    │   └── query-rules.test.ts
    ├── storage/
    │   ├── rule-repo.test.ts
    │   └── diff-log-repo.test.ts
    └── conflict/
        └── arbitrator.test.ts
```


### Task 1: 项目脚手架 + Prisma Schema

**Files:**
- Create: `D:\Desktop\mcp\package.json`
- Create: `D:\Desktop\mcp\tsconfig.json`
- Create: `D:\Desktop\mcp\vitest.config.ts`
- Create: `D:\Desktop\mcp\prisma\schema.prisma`
- Create: `D:\Desktop\mcp\.env`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "agent-tuning-reverse-graph",
  "version": "0.1.0",
  "description": "MCP Server for Agent Training Reverse Graph System",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.6.0",
    "@prisma/client": "^5.22.0",
    "tree-sitter": "^0.21.1",
    "web-tree-sitter": "^0.21.2"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
    },
  },
});
```

- [ ] **Step 4: 创建 Prisma Schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Rule {
  id              String   @id @default(uuid())
  projectId       String?
  scope           String   @default("project")
  priority        Float    @default(1.0)
  type            String
  pattern         String
  suggestion      String
  language        String   @default("typescript")
  fileExtensions  String?
  tags            String?
  confidence      String   @default("medium")
  source          String   @default("auto")
  category        String?
  status          String   @default("active")
  matchCount      Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastUsedAt      DateTime?
  diffLogs        DiffLog[]
  conflictA       ConflictRecord[] @relation("conflictRuleA")
  conflictB       ConflictRecord[] @relation("conflictRuleB")
}

model DiffLog {
  id             String   @id @default(uuid())
  ruleId         String?
  filePath       String
  fileExtension  String
  language       String
  projectId      String?
  originalHash   String
  modifiedHash   String
  diffContent    String
  astStatus      String?
  diffType       String
  operations     String?
  createdAt      DateTime @default(now())
  rule           Rule?    @relation(fields: [ruleId], references: [id])
}

model ConflictRecord {
  id          String    @id @default(uuid())
  ruleAId     String
  ruleBId     String
  scopeKey    String
  resolution  String?
  batchChoice String?
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  ruleA       Rule      @relation("conflictRuleA", fields: [ruleAId], references: [id])
  ruleB       Rule      @relation("conflictRuleB", fields: [ruleBId], references: [id])
}

model MetricEvent {
  id          String   @id @default(uuid())
  eventType   String
  properties  String?
  createdAt   DateTime @default(now())
}

model AppConfig {
  id    String @id @default("default")
  mode  String @default("silent")
  data  String?
}
```

- [ ] **Step 5: 创建 .env**

```
DATABASE_URL="file:./data/rules.db"
```

- [ ] **Step 6: 安装依赖**

Run: `cd D:\Desktop\mcp && npm install`
Expected: node_modules/ 创建完成

- [ ] **Step 7: 生成 Prisma 客户端**

Run: `cd D:\Desktop\mcp && npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 8: 提交**

```bash
git add package.json tsconfig.json vitest.config.ts prisma/ .env
git commit -m "chore: scaffold project with Prisma + SQLite + MCP SDK"
```


### Task 2: 共享类型定义

**Files:**
- Create: `D:\Desktop\mcp\src\types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
export interface ASTNode {
  type: string;
  text: string;
  startByte: number;
  endByte: number;
  children: ASTNode[];
}

export interface NodeSignature {
  type: string;
  textHash: string;
  childrenCount: number;
  childTypesHash: string;     // 子节点类型序列的哈希（平铺结构指纹）
  structuralHash: string;     // 递归子树形状哈希（Merkle-tree 风格）
}

export type AtomicOpType = "UPDATE" | "MOVE" | "INSERT" | "DELETE";

export interface AtomicOp {
  type: AtomicOpType;
  nodeType: string;
  originalText?: string;
  modifiedText?: string;
  startByte: number;
  endByte: number;
  parentType?: string;
}

export interface DiffResult {
  operations: AtomicOp[];
  status: "success" | "fallback" | "failed";
  confidence: "high" | "medium" | "low";
  processedBytes: number;
  durationMs: number;
  error?: string;
}

export type RuleScope = "project" | "user" | "global";
export type RuleType = "replace" | "restructure" | "convention";
export type RuleConfidence = "high" | "medium" | "low";
export type RuleSource = "auto" | "manual" | "arbitration";
export type RuleStatus = "active" | "pending" | "archived";

export interface RuleSpec {
  type: RuleType;
  pattern: string;
  suggestion: string;
  language: string;
  fileExtensions?: string[];
  tags?: string[];
  category?: string;
  scope?: RuleScope;
}

export interface Rule extends RuleSpec {
  id: string;
  projectId?: string;
  priority: number;
  confidence: RuleConfidence;
  source: RuleSource;
  status: RuleStatus;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

export interface MatchContext {
  language: string;
  filePath: string;
  fileExtension: string;
  projectId?: string;
  ruleTags?: string[];
  currentTime?: Date;
}

export interface ScoredRule {
  rule: Rule;
  score: number;
  matchReasons: string[];
}

export interface MatchResult {
  rules: ScoredRule[];
  totalTokens: number;
  truncated: boolean;
  queryDurationMs: number;
}

export type ConflictResolution = "keep_a" | "keep_b" | "merge" | "skip";

export interface ConflictInfo {
  id: string;
  ruleA: Rule;
  ruleB: Rule;
  scopeKey: string;
  resolution?: ConflictResolution;
  createdAt: Date;
}

export interface CaptureDiffInput {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string;
  projectId?: string;
}

export interface QueryRulesInput {
  language: string;
  filePath: string;
  projectId?: string;
  tags?: string[];
}

export interface ConfirmRuleInput {
  ruleId: string;
  action: "accept" | "reject" | "edit" | "skip";
  editedPattern?: string;
  editedSuggestion?: string;
}

export interface ResolveConflictInput {
  conflictId: string;
  resolution: ConflictResolution;
  batchAllSession?: boolean;
}

export interface ListRulesInput {
  language?: string;
  scope?: RuleScope;
  status?: RuleStatus;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface AppConfigData {
  mode: "silent" | "confirm";
}

export const DEFAULT_WEIGHTS = {
  typeWeight: 0.4,
  timeWeight: 0.3,
  matchWeight: 0.3,
  timeDecayLambda: 0.01,
} as const;

export const SCOPE_PRIORITIES: Record<RuleScope, number> = {
  project: 1.0,
  user: 0.8,
  global: 0.5,
};

export const TOKEN_LIMITS = {
  maxInjectionTokens: 2000,
  maxSingleRuleTokens: 100,
  maxRulesPerProject: 2000,
  maxRulesGlobal: 3000,
} as const;

export const RULE_GENERATION_THRESHOLDS = {
  minDistinctFiles: 3,
  minRepeatsInDays: 5,
  repeatWindowDays: 7,
} as const;
```

- [ ] **Step 2: 验证编译**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 3: 提交**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```


### Task 3: 存储层 — Prisma 客户端 + 仓库

**Files:**
- Create: `D:\Desktop\mcp\src\storage\client.ts`
- Create: `D:\Desktop\mcp\src\storage\rule-repo.ts`
- Create: `D:\Desktop\mcp\src\storage\diff-log-repo.ts`
- Create: `D:\Desktop\mcp\src\storage\conflict-repo.ts`
- Create: `D:\Desktop\mcp\src\storage\metric-repo.ts`

- [ ] **Step 1: 创建 Prisma 客户端**

```typescript
// src/storage/client.ts
import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: ["warn", "error"],
    });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
```

- [ ] **Step 2: 创建 RuleRepo**

```typescript
// src/storage/rule-repo.ts
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import {
  Rule, RuleScope, RuleStatus, RuleSpec, TOKEN_LIMITS,
} from "../types.js";

export function toRule(r: Prisma.RuleGetPayload<{}>): Rule {
  return {
    id: r.id,
    projectId: r.projectId ?? undefined,
    scope: r.scope as RuleScope,
    priority: r.priority,
    type: r.type as Rule["type"],
    pattern: r.pattern,
    suggestion: r.suggestion,
    language: r.language,
    fileExtensions: r.fileExtensions ? r.fileExtensions.split(",") : undefined,
    tags: r.tags ? r.tags.split(",") : undefined,
    confidence: r.confidence as Rule["confidence"],
    source: r.source as Rule["source"],
    category: r.category ?? undefined,
    status: r.status as RuleStatus,
    matchCount: r.matchCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastUsedAt: r.lastUsedAt ?? undefined,
  };
}

export class RuleRepo {
  async create(spec: RuleSpec & { projectId?: string }): Promise<Rule> {
    const prisma = getPrismaClient();
    const r = await prisma.rule.create({
      data: {
        projectId: spec.projectId ?? null,
        scope: spec.scope ?? "project",
        type: spec.type,
        pattern: spec.pattern,
        suggestion: spec.suggestion,
        language: spec.language,
        fileExtensions: spec.fileExtensions?.join(",") ?? null,
        tags: spec.tags?.join(",") ?? null,
        category: spec.category ?? null,
        confidence: "medium",
        source: "auto",
      },
    });
    return toRule(r);
  }

  async findById(id: string): Promise<Rule | null> {
    const prisma = getPrismaClient();
    const r = await prisma.rule.findUnique({ where: { id } });
    return r ? toRule(r) : null;
  }

  async updateStatus(id: string, status: RuleStatus): Promise<Rule> {
    const prisma = getPrismaClient();
    const r = await prisma.rule.update({
      where: { id },
      data: { status },
    });
    return toRule(r);
  }

  async incrementMatchCount(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.rule.update({
      where: { id },
      data: {
        matchCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async countByScope(scope: RuleScope): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.rule.count({ where: { scope, status: "active" } });
  }

  async isLimitReached(): Promise<boolean> {
    const globalCount = await this.countByScope("global");
    if (globalCount >= TOKEN_LIMITS.maxRulesGlobal) return true;
    return false;
  }

  async findConflicting(type: string, language: string, pattern: string): Promise<Rule[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.rule.findMany({
      where: { type, language, pattern: { contains: pattern }, status: "active" },
    });
    return rows.map(toRule);
  }

  async queryByMatch(
    language: string, fileExtension: string,
    projectId?: string, tags?: string[],
  ): Promise<Rule[]> {
    const prisma = getPrismaClient();
    const where: Prisma.RuleWhereInput = {
      status: "active",
      OR: [{ language: "*" }, { language }],
    };
    if (fileExtension) {
      where.fileExtensions = { contains: fileExtension.replace(".", "") };
    }
    const rows = await prisma.rule.findMany({ where, orderBy: { priority: "desc" } });
    return rows.map(toRule);
  }

  async list(filters: {
    language?: string; scope?: RuleScope; status?: RuleStatus;
    projectId?: string; limit?: number; offset?: number;
  }): Promise<Rule[]> {
    const prisma = getPrismaClient();
    const where: Prisma.RuleWhereInput = {};
    if (filters.language) where.language = filters.language;
    if (filters.scope) where.scope = filters.scope;
    if (filters.status) where.status = filters.status;
    if (filters.projectId) where.projectId = filters.projectId;
    const rows = await prisma.rule.findMany({
      where,
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRule);
  }
}
```

- [ ] **Step 3: 创建 DiffLogRepo**

```typescript
// src/storage/diff-log-repo.ts
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client.js";

export interface DiffLogRecord {
  id: string;
  ruleId?: string;
  filePath: string;
  fileExtension: string;
  language: string;
  projectId?: string;
  originalHash: string;
  modifiedHash: string;
  diffContent: string;
  astStatus?: string;
  diffType: string;
  operations?: string;
  createdAt: Date;
}

function toRecord(r: Prisma.DiffLogGetPayload<{}>): DiffLogRecord {
  return {
    id: r.id, ruleId: r.ruleId ?? undefined,
    filePath: r.filePath, fileExtension: r.fileExtension,
    language: r.language, projectId: r.projectId ?? undefined,
    originalHash: r.originalHash, modifiedHash: r.modifiedHash,
    diffContent: r.diffContent, astStatus: r.astStatus ?? undefined,
    diffType: r.diffType, operations: r.operations ?? undefined,
    createdAt: r.createdAt,
  };
}

export class DiffLogRepo {
  async create(data: {
    filePath: string; fileExtension: string; language: string;
    projectId?: string; originalHash: string; modifiedHash: string;
    diffContent: string; astStatus?: string; diffType: string;
    operations?: string; ruleId?: string;
  }): Promise<DiffLogRecord> {
    const prisma = getPrismaClient();
    const r = await prisma.diffLog.create({ data });
    return toRecord(r);
  }

  async countByPattern(language: string, patternHash: string, sinceDays: number): Promise<number> {
    const prisma = getPrismaClient();
    const since = new Date(Date.now() - sinceDays * 86400000);
    return prisma.diffLog.count({
      where: { language, originalHash: patternHash, createdAt: { gte: since } },
    });
  }

  async countDistinctFiles(language: string, patternHash: string, sinceDays: number): Promise<number> {
    const prisma = getPrismaClient();
    const since = new Date(Date.now() - sinceDays * 86400000);
    const rows = await prisma.diffLog.findMany({
      where: { language, originalHash: patternHash, createdAt: { gte: since } },
      select: { filePath: true },
      distinct: ["filePath"],
    });
    return rows.length;
  }
}
```

- [ ] **Step 4: 创建 ConflictRepo**

```typescript
// src/storage/conflict-repo.ts
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import { ConflictResolution } from "../types.js";
import { RuleRepo } from "./rule-repo.js";

export interface ConflictRecord {
  id: string; ruleAId: string; ruleBId: string;
  scopeKey: string; resolution?: ConflictResolution;
  batchChoice?: string; resolvedAt?: Date; createdAt: Date;
}

export class ConflictRepo {
  constructor(private ruleRepo: RuleRepo) {}

  async findById(id: string): Promise<ConflictRecord | null> {
    const prisma = getPrismaClient();
    const r = await prisma.conflictRecord.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id, ruleAId: r.ruleAId, ruleBId: r.ruleBId,
      scopeKey: r.scopeKey,
      resolution: r.resolution as ConflictResolution | undefined,
      batchChoice: r.batchChoice ?? undefined,
      resolvedAt: r.resolvedAt ?? undefined, createdAt: r.createdAt,
    };
  }

  async findExisting(ruleAId: string, ruleBId: string): Promise<ConflictRecord | null> {
    const prisma = getPrismaClient();
    const r = await prisma.conflictRecord.findFirst({
      where: {
        OR: [
          { ruleAId, ruleBId },
          { ruleAId: ruleBId, ruleBId: ruleAId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!r) return null;
    return {
      id: r.id, ruleAId: r.ruleAId, ruleBId: r.ruleBId,
      scopeKey: r.scopeKey,
      resolution: r.resolution as ConflictResolution | undefined,
      batchChoice: r.batchChoice ?? undefined,
      resolvedAt: r.resolvedAt ?? undefined, createdAt: r.createdAt,
    };
  }

  async create(data: { ruleAId: string; ruleBId: string; scopeKey: string }): Promise<ConflictRecord> {
    const prisma = getPrismaClient();
    const r = await prisma.conflictRecord.create({ data });
    return {
      id: r.id, ruleAId: r.ruleAId, ruleBId: r.ruleBId,
      scopeKey: r.scopeKey, createdAt: r.createdAt,
    };
  }

  async resolve(id: string, resolution: ConflictResolution): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.conflictRecord.update({
      where: { id },
      data: { resolution, resolvedAt: new Date() },
    });
  }

  async setBatchChoice(id: string, choice: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.conflictRecord.update({
      where: { id },
      data: { batchChoice: choice },
    });
  }
}
```

- [ ] **Step 5: 创建 MetricRepo**

```typescript
// src/storage/metric-repo.ts
import { getPrismaClient } from "./client.js";

export class MetricRepo {
  async track(eventType: string, properties?: Record<string, unknown>): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.metricEvent.create({
      data: {
        eventType,
        properties: properties ? JSON.stringify(properties) : null,
      },
    });
  }

  async count(eventType: string, sinceMinutes?: number): Promise<number> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = { eventType };
    if (sinceMinutes) {
      where.createdAt = { gte: new Date(Date.now() - sinceMinutes * 60000) };
    }
    return prisma.metricEvent.count({ where: where as any });
  }
}
```

- [ ] **Step 6: 验证编译**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 7: 提交**

```bash
git add src/storage/
git commit -m "feat: add Prisma client and storage repositories"
```


### Task 4: AST Diff 引擎

**Files:**
- Create: `D:\Desktop\mcp\src\engine\ast-node.ts`
- Create: `D:\Desktop\mcp\src\engine\ast-diff.ts`
- Create: `D:\Desktop\mcp\src\engine\parsers.ts`
- Create: `D:\Desktop\mcp\src\engine\regex-fallback.ts`
- Create: `tests\engine\ast-diff.test.ts`

- [ ] **Step 1: 创建 ast-node.ts（AST 节点签名）**

```typescript
// src/engine/ast-node.ts
import { ASTNode, NodeSignature } from "../types.js";

export function computeSignature(node: ASTNode, childSigs?: NodeSignature[], hashFn?: (s: string) => string): NodeSignature {
  const hash = (hashFn ?? simpleHash);
  // structuralHash: 递归 Merkle-tree 风格指纹
  const childStructHashes = childSigs
    ? childSigs.map(s => s.structuralHash)
    : node.children.map(c => computeSignature(c, undefined, hashFn).structuralHash);
  const structuralHash = hash(node.type + "[" + childStructHashes.join(",") + "]");
  const childTypes = node.children.map(c => c.type).join(",");
  return {
    type: node.type,
    textHash: hash(node.text),
    childrenCount: node.children.length,
    childTypesHash: hash(childTypes),
    structuralHash,
  };
}

function simpleHash(s: string): string {
  if (!s) return "0";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(16);
}

export function buildSignatureMap(
  node: ASTNode, hashFn?: (s: string) => string,
): Map<ASTNode, NodeSignature> {
  const map = new Map<ASTNode, NodeSignature>();
  function walk(n: ASTNode): void {
    for (const child of n.children) walk(child);
    map.set(n, computeSignature(n, hashFn));
  }
  walk(node);
  return map;
}
```

- [ ] **Step 2: 写测试文件（TDD — 先写测试）**

```typescript
// tests/engine/ast-diff.test.ts
import { describe, it, expect } from "vitest";
import { computeDiff } from "../../src/engine/ast-diff.js";
import { ASTNode } from "../../src/types.js";

describe("AST Diff Engine", () => {
  function makeNode(type: string, text: string, children: ASTNode[] = []): ASTNode {
    return { type, text, startByte: 0, endByte: text.length, children };
  }

  it("should detect UPDATE when node text changes but type stays same", () => {
    const oldAst = makeNode("function", "function oldName() {}", [
      makeNode("identifier", "oldName"),
      makeNode("body", "{}"),
    ]);
    const newAst = makeNode("function", "function newName() {}", [
      makeNode("identifier", "newName"),
      makeNode("body", "{}"),
    ]);
    const result = computeDiff(oldAst, newAst);
    expect(result.status).toBe("success");
    expect(result.operations.some(op => op.type === "UPDATE")).toBe(true);
  });

  it("should detect INSERT when new children exist", () => {
    const oldAst = makeNode("program", "code", []);
    const newAst = makeNode("program", "code // comment", [
      makeNode("comment", "// comment"),
    ]);
    const result = computeDiff(oldAst, newAst);
    expect(result.operations.some(op => op.type === "INSERT")).toBe(true);
  });

  it("should detect DELETE when children are removed", () => {
    const oldAst = makeNode("program", "code", [
      makeNode("comment", "// old comment"),
    ]);
    const newAst = makeNode("program", "code", []);
    const result = computeDiff(oldAst, newAst);
    expect(result.operations.some(op => op.type === "DELETE")).toBe(true);
  });

  it("should return empty ops for identical trees", () => {
    const ast = makeNode("program", "const x = 1;", [
      makeNode("variable_declaration", "const x = 1;"),
    ]);
    const result = computeDiff(ast, ast);
    expect(result.operations.length).toBe(0);
    expect(result.status).toBe("success");
  });

  it("should return failed for null/empty trees", () => {
    const result = computeDiff(null as any, null as any);
    expect(result.status).toBe("failed");
    expect(result.operations).toEqual([]);
  });

  it("should set confidence to high for clean diffs", () => {
    const ast = makeNode("program", "const x = 1;", [
      makeNode("variable_declaration", "const x = 1;"),
    ]);
    const result = computeDiff(ast, ast);
    expect(result.confidence).toBe("high");
  });
});
```

- [ ] **Step 3: 运行测试（预期失败）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/engine/ast-diff.test.ts`
Expected: FAIL

- [ ] **Step 4: 实现 AST Diff 算法**

```typescript
// src/engine/ast-diff.ts
import { ASTNode, AtomicOp, DiffResult, NodeSignature } from "../types.js";
import { buildSignatureMap } from "./ast-node.js";

/** 增强签名匹配：structuralHash 递归包含类型 + 子节点结构，是最精确的比较。
 *  结构相同的子树视为匹配，文本差异下沉到 UPDATE 层面处理，避免整棵子树被误判为 INSERT/DELETE。 */
function signaturesEqual(a?: NodeSignature, b?: NodeSignature): boolean {
  if (!a || !b) return false;
  return a.structuralHash === b.structuralHash;
}

function findMatchingChild(
  child: ASTNode, candidates: ASTNode[],
  sigMap: Map<ASTNode, NodeSignature>, used: Set<ASTNode>,
): ASTNode | undefined {
  const sig = sigMap.get(child);
  if (!sig) return undefined;
  return candidates.find(c => !used.has(c) && signaturesEqual(sigMap.get(c), sig));
}

export function computeDiff(oldAst: ASTNode, newAst: ASTNode): DiffResult {
  const startTime = performance.now();
  try {
    if (!oldAst || !newAst) {
      return { operations: [], status: "failed", confidence: "low", processedBytes: 0, durationMs: performance.now() - startTime, error: "Invalid AST" };
    }
    const oldSigs = buildSignatureMap(oldAst);
    const newSigs = buildSignatureMap(newAst);
    const operations: AtomicOp[] = [];
    const matchedNew = new Set<ASTNode>();

    function walk(oldNode: ASTNode, newNode: ASTNode): void {
      const usedInThisLevel = new Set<ASTNode>();
      for (const oc of oldNode.children) {
        const match = findMatchingChild(oc, newNode.children, newSigs, usedInThisLevel);
        if (match) {
          usedInThisLevel.add(match);
          matchedNew.add(match);
          if (oc.text !== match.text && oc.type === match.type) {
            operations.push({ type: "UPDATE", nodeType: oc.type, originalText: oc.text, modifiedText: match.text, startByte: Math.min(oc.startByte, match.startByte), endByte: Math.max(oc.endByte, match.endByte) });
          }
          walk(oc, match);
        } else {
          operations.push({ type: "DELETE", nodeType: oc.type, originalText: oc.text, startByte: oc.startByte, endByte: oc.endByte, parentType: oldNode.type });
        }
      }
      for (const nc of newNode.children) {
        if (!usedInThisLevel.has(nc)) {
          operations.push({ type: "INSERT", nodeType: nc.type, modifiedText: nc.text, startByte: nc.startByte, endByte: nc.endByte, parentType: newNode.type });
        }
      }
    }

    walk(oldAst, newAst);
    const durationMs = performance.now() - startTime;
    const totalNodes = oldAst.children.length + newAst.children.length;
    const threshold = Math.max(totalNodes * 0.6, 1);
    return {
      operations,
      status: operations.length <= threshold ? "success" : "fallback",
      confidence: operations.length <= threshold ? "high" : "low",
      processedBytes: Math.max(oldAst.endByte, newAst.endByte),
      durationMs,
    };
  } catch (err) {
    return { operations: [], status: "failed", confidence: "low", processedBytes: 0, durationMs: performance.now() - startTime, error: String(err) };
  }
}
```

- [ ] **Step 5: 运行测试（预期通过）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/engine/ast-diff.test.ts`
Expected: PASS

- [ ] **Step 6: 创建解析器和正则降级**

```typescript
// src/engine/regex-fallback.ts
import { AtomicOp, DiffResult } from "../types.js";

export function regexDiff(original: string, modified: string): DiffResult {
  const startTime = performance.now();
  try {
    const origLines = original.split("\n");
    const modLines = modified.split("\n");
    const ops: AtomicOp[] = [];
    const maxLen = Math.max(origLines.length, modLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= origLines.length) {
        ops.push({ type: "INSERT", nodeType: "line", modifiedText: modLines[i], startByte: 0, endByte: 0 });
      } else if (i >= modLines.length) {
        ops.push({ type: "DELETE", nodeType: "line", originalText: origLines[i], startByte: 0, endByte: 0 });
      } else if (origLines[i] !== modLines[i]) {
        ops.push({ type: "UPDATE", nodeType: "line", originalText: origLines[i], modifiedText: modLines[i], startByte: 0, endByte: 0 });
      }
    }
    return { operations: ops, status: "fallback", confidence: "medium", processedBytes: Math.max(original.length, modified.length), durationMs: performance.now() - startTime };
  } catch (err) {
    return { operations: [], status: "failed", confidence: "low", processedBytes: 0, durationMs: performance.now() - startTime, error: String(err) };
  }
}
```

```typescript
// src/engine/parsers.ts
import { ASTNode } from "../types.js";
import { computeDiff } from "./ast-diff.js";
import { regexDiff } from "./regex-fallback.js";

export interface ParserResult { ast: ASTNode; language: string; parseSuccess: boolean; }

export async function parseToAST(code: string, language: string): Promise<ParserResult> {
  const lines = code.split("\n");
  const children: ASTNode[] = lines.map((line, i) => ({
    type: "line", text: line,
    startByte: code.indexOf(line, i > 0 ? code.indexOf(lines[i - 1]) + lines[i - 1].length : 0),
    endByte: code.indexOf(line, i > 0 ? code.indexOf(lines[i - 1]) + lines[i - 1].length : 0) + line.length,
    children: [],
  }));
  const ast: ASTNode = { type: "program", text: code, startByte: 0, endByte: code.length, children };
  return { ast, language, parseSuccess: true };
}

export async function computeDiffWithFallback(originalCode: string, modifiedCode: string, language: string) {
  try {
    const { ast: oldAst } = await parseToAST(originalCode, language);
    const { ast: newAst } = await parseToAST(modifiedCode, language);
    const result = computeDiff(oldAst, newAst);
    if (result.status === "failed" || result.confidence === "low") {
      return { ...regexDiff(originalCode, modifiedCode), fallbackReason: "ast_low_confidence" };
    }
    return result;
  } catch {
    return regexDiff(originalCode, modifiedCode);
  }
}
```

- [ ] **Step 7: 验证编译 + 全部测试通过**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit && npx vitest run tests/engine/ast-diff.test.ts`
Expected: 编译通过，测试通过

- [ ] **Step 8: 提交**

```bash
git add src/engine/ tests/engine/ast-diff.test.ts
git commit -m "feat: implement AST diff engine with signature matching + regex fallback"
```


### Task 5: 规则生成器

**Files:**
- Create: `D:\Desktop\mcp\src\engine\rule-generator.ts`
- Create: `tests\engine\rule-generator.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/engine/rule-generator.test.ts
import { describe, it, expect } from "vitest";
import { evaluateRuleCandidate } from "../../src/engine/rule-generator.js";
import { AtomicOp } from "../../src/types.js";

describe("Rule Generator", () => {
  it("should not generate rule when ops are below thresholds", () => {
    const ops: AtomicOp[] = [
      { type: "UPDATE", nodeType: "identifier", originalText: "foo", modifiedText: "bar", startByte: 0, endByte: 5 },
    ];
    const result = evaluateRuleCandidate(ops, "typescript", 2, 1, 2);
    expect(result.generate).toBe(false);
    expect(result.reason).toContain("below threshold");
  });

  it("should generate rule when distinct files threshold met", () => {
    const ops: AtomicOp[] = [
      { type: "UPDATE", nodeType: "identifier", originalText: "foo", modifiedText: "bar", startByte: 0, endByte: 5 },
    ];
    const result = evaluateRuleCandidate(ops, "typescript", 3, 1, 5);
    expect(result.generate).toBe(true);
    expect(result.ruleCandidate).toBeDefined();
    expect(result.ruleCandidate!.type).toBe("replace");
    expect(result.ruleCandidate!.pattern).toContain("foo");
  });

  it("should generate rule when repeat count threshold met", () => {
    const ops: AtomicOp[] = [
      { type: "UPDATE", nodeType: "identifier", originalText: "oldName", modifiedText: "newName", startByte: 0, endByte: 10 },
    ];
    const result = evaluateRuleCandidate(ops, "typescript", 1, 5, 5);
    expect(result.generate).toBe(true);
    expect(result.reason).toContain("repeat");
  });

  it("should not generate rule for INSERT-only with low occurrence", () => {
    const ops: AtomicOp[] = [
      { type: "INSERT", nodeType: "comment", modifiedText: "// TODO", startByte: 0, endByte: 7 },
    ];
    const result = evaluateRuleCandidate(ops, "typescript", 1, 1, 2);
    expect(result.generate).toBe(false);
  });

  it("should return low confidence when many operations", () => {
    const ops: AtomicOp[] = [
      { type: "UPDATE", nodeType: "line", originalText: "l1", modifiedText: "nl1", startByte: 0, endByte: 3 },
      { type: "UPDATE", nodeType: "line", originalText: "l2", modifiedText: "nl2", startByte: 0, endByte: 3 },
      { type: "UPDATE", nodeType: "line", originalText: "l3", modifiedText: "nl3", startByte: 0, endByte: 3 },
      { type: "INSERT", nodeType: "line", modifiedText: "newLine", startByte: 0, endByte: 0 },
    ];
    const result = evaluateRuleCandidate(ops, "typescript", 3, 1, 5);
    expect(result.ruleCandidate?.confidence).toBe("low");
  });
});
```

- [ ] **Step 2: 运行测试（预期失败）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/engine/rule-generator.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现规则生成器**

```typescript
// src/engine/rule-generator.ts
import { AtomicOp, RuleConfidence, RuleSpec, RULE_GENERATION_THRESHOLDS } from "../types.js";

export interface RuleCandidateEval {
  generate: boolean;
  ruleCandidate?: RuleSpec;
  reason: string;
  confidence: RuleConfidence;
}

export function evaluateRuleCandidate(
  ops: AtomicOp[], language: string,
  distinctFiles: number, repeatCount: number, windowDays: number,
): RuleCandidateEval {
  if (ops.length === 0) {
    return { generate: false, reason: "no operations", confidence: "medium" };
  }
  const meetsFileThreshold = distinctFiles >= RULE_GENERATION_THRESHOLDS.minDistinctFiles;
  const meetsRepeatThreshold = repeatCount >= RULE_GENERATION_THRESHOLDS.minRepeatsInDays;
  if (!meetsFileThreshold && !meetsRepeatThreshold) {
    return { generate: false, reason: `below threshold: ${distinctFiles} files (need ${RULE_GENERATION_THRESHOLDS.minDistinctFiles}), ${repeatCount} repeats (need ${RULE_GENERATION_THRESHOLDS.minRepeatsInDays})`, confidence: "medium" };
  }
  const updateOps = ops.filter(o => o.type === "UPDATE");
  const moveOps = ops.filter(o => o.type === "MOVE");
  let ruleType: RuleSpec["type"] = "replace";
  if (moveOps.length > 0 && moveOps.length >= updateOps.length) ruleType = "restructure";
  if (ops.every(o => o.type === "INSERT" || o.type === "DELETE")) {
    return { generate: false, reason: "only insert/delete ops with insufficient pattern", confidence: "low" };
  }
  const dominantUpdate = updateOps.length > 0 ? updateOps[0] : ops[0];
  const pattern = dominantUpdate.originalText ?? "";
  const suggestion = dominantUpdate.modifiedText ?? "";
  let confidence: RuleConfidence = "high";
  if (ops.length > 3) confidence = "low";
  else if (ops.some(o => o.type === "INSERT" || o.type === "DELETE")) confidence = "medium";
  return {
    generate: true,
    ruleCandidate: { type: ruleType, pattern, suggestion, language, confidence },
    reason: `meets threshold: ${distinctFiles} files, ${repeatCount} repeats`,
    confidence,
  };
}
```

- [ ] **Step 4: 运行测试（预期通过）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/engine/rule-generator.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/rule-generator.ts tests/engine/rule-generator.test.ts
git commit -m "feat: implement rule generator with threshold logic"
```


### Task 6: 规则匹配器 + Token 控制

**Files:**
- Create: `D:\Desktop\mcp\src\engine\token-controller.ts`
- Create: `D:\Desktop\mcp\src\engine\rule-matcher.ts`
- Create: `tests\engine\token-controller.test.ts`
- Create: `tests\engine\rule-matcher.test.ts`

- [ ] **Step 1: 写 Token Controller 测试**

```typescript
// tests/engine/token-controller.test.ts
import { describe, it, expect } from "vitest";
import { estimateTokens, truncateRules } from "../../src/engine/token-controller.js";
import { Rule } from "../../src/types.js";

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return { id: "1", type: "replace", pattern: "foo", suggestion: "bar", language: "typescript", priority: 1.0, scope: "project", confidence: "high", source: "auto", status: "active", matchCount: 0, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

describe("Token Controller", () => {
  it("should estimate tokens for ASCII text", () => {
    const tokens = estimateTokens("hello world foo bar");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });
  it("should keep all rules when under limit", () => {
    const result = truncateRules([makeRule()], 2000);
    expect(result.rules).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });
  it("should truncate when over limit", () => {
    const rules: Rule[] = [];
    for (let i = 0; i < 100; i++) {
      rules.push(makeRule({ id: String(i), pattern: "x".repeat(80), suggestion: "y".repeat(80) }));
    }
    const result = truncateRules(rules, 500);
    expect(result.truncated).toBe(true);
    expect(result.totalTokens).toBeLessThanOrEqual(550);
  });
  it("should return empty for empty input", () => {
    const result = truncateRules([], 2000);
    expect(result.rules).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });
});
```

- [ ] **Step 2: 实现 Token Controller**

```typescript
// src/engine/token-controller.ts
import { Rule, TOKEN_LIMITS } from "../types.js";

export function estimateTokens(text: string): number {
  const bytes = new TextEncoder().encode(text).length;
  return Math.ceil(bytes / 3.5);
}

function formatRule(r: Rule): string {
  return `[${r.type}] ${r.pattern} → ${r.suggestion}${r.fileExtensions ? " (files: "+r.fileExtensions+")" : ""}${r.tags ? " ["+r.tags+"]" : ""}${r.priority !== 1.0 ? " priority:"+r.priority : ""}`;
}

export function truncateRules(rules: Rule[], maxTokens: number = TOKEN_LIMITS.maxInjectionTokens) {
  let totalTokens = 0;
  const selected: Rule[] = [];
  const budget = Math.min(maxTokens, TOKEN_LIMITS.maxInjectionTokens);
  for (const rule of rules) {
    const formatted = formatRule(rule);
    const tokens = estimateTokens(formatted);
    if (tokens > TOKEN_LIMITS.maxSingleRuleTokens) continue;
    if (totalTokens + tokens > budget) break;
    selected.push(rule);
    totalTokens += tokens;
  }
  return { rules: selected, totalTokens, truncated: selected.length < rules.length };
}
```

- [ ] **Step 3: 写 Rule Matcher 测试**

```typescript
// tests/engine/rule-matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchRules, computeScore } from "../../src/engine/rule-matcher.js";
import { Rule, MatchContext } from "../../src/types.js";

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return { id: "1", type: "replace", pattern: "foo", suggestion: "bar", language: "typescript", priority: 1.0, scope: "project", confidence: "high", source: "auto", status: "active", matchCount: 3, tags: "api,utils", createdAt: new Date(Date.now() - 86400000 * 2), updatedAt: new Date(), lastUsedAt: new Date(), ...overrides };
}

describe("Rule Matcher", () => {
  it("should score higher for exact language match", () => {
    const rule = makeRule({ language: "typescript" });
    const ctx: MatchContext = { language: "typescript", filePath: "utils.ts", fileExtension: ".ts" };
    expect(computeScore(rule, ctx)).toBeGreaterThan(0);
  });
  it("should score zero for non-matching language", () => {
    const rule = makeRule({ language: "python" });
    const ctx: MatchContext = { language: "typescript", filePath: "utils.ts", fileExtension: ".ts" };
    expect(computeScore(rule, ctx)).toBe(0);
  });
  it("should score wildcard for all languages", () => {
    const rule = makeRule({ language: "*" });
    const ctx: MatchContext = { language: "go", filePath: "main.go", fileExtension: ".go" };
    expect(computeScore(rule, ctx)).toBeGreaterThan(0);
  });
  it("should decay score over time", () => {
    const oldRule = makeRule({ createdAt: new Date(Date.now() - 86400000 * 30), matchCount: 0 });
    const newRule = makeRule({ createdAt: new Date(), matchCount: 0 });
    const ctx: MatchContext = { language: "typescript", filePath: "utils.ts", fileExtension: ".ts" };
    expect(computeScore(newRule, ctx)).toBeGreaterThan(computeScore(oldRule, ctx));
  });
  it("should return top-K rules sorted by score", () => {
    const rules: Rule[] = [
      makeRule({ id: "1", language: "typescript", matchCount: 10 }),
      makeRule({ id: "2", language: "typescript", matchCount: 5 }),
      makeRule({ id: "3", language: "typescript", matchCount: 1 }),
      makeRule({ id: "4", language: "python" }),
    ];
    const ctx: MatchContext = { language: "typescript", filePath: "app.ts", fileExtension: ".ts" };
    const result = matchRules(rules, ctx, { topK: 2 });
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].score).toBeGreaterThanOrEqual(result.rules[1].score);
  });
  it("should include match reasons", () => {
    const rule = makeRule({ language: "typescript", tags: "api" });
    const ctx: MatchContext = { language: "typescript", filePath: "api/route.ts", fileExtension: ".ts", ruleTags: ["api"] };
    const result = matchRules([rule], ctx, { topK: 5 });
    expect(result.rules[0].matchReasons.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: 实现 Rule Matcher**

```typescript
// src/engine/rule-matcher.ts
import { Rule, ScoredRule, MatchContext, MatchResult, DEFAULT_WEIGHTS, SCOPE_PRIORITIES } from "../types.js";
import { estimateTokens, truncateRules } from "./token-controller.js";

export function computeScore(rule: Rule, context: MatchContext): number {
  if (rule.language !== "*" && rule.language !== context.language) return 0;
  const now = context.currentTime ?? new Date();
  const { typeWeight, timeWeight, matchWeight, timeDecayLambda } = DEFAULT_WEIGHTS;
  const typeValue = rule.type === "replace" ? 1.0 : rule.type === "restructure" ? 0.8 : 0.6;
  const hoursSinceCreation = (now.getTime() - rule.createdAt.getTime()) / 3600000;
  const timeValue = Math.exp(-timeDecayLambda * hoursSinceCreation);
  let matchValue = 0;
  const path = context.filePath.toLowerCase();
  const tags = context.ruleTags ?? [];
  if (rule.tags) {
    for (const tag of rule.tags.split(",")) {
      if (path.includes(tag.trim().toLowerCase())) matchValue += 1;
    }
    const ruleTagList = rule.tags.split(",").map(t => t.trim().toLowerCase());
    for (const tag of tags) {
      if (ruleTagList.includes(tag.toLowerCase())) matchValue += 1;
    }
  }
  const priorityBonus = SCOPE_PRIORITIES[rule.scope] ?? 0.5;
  const score = (typeWeight * typeValue) + (timeWeight * timeValue) + (matchWeight * (matchValue / Math.max(matchValue, 1)));
  return score * priorityBonus;
}

export interface MatchOptions { topK?: number; maxTokens?: number; }

export function matchRules(rules: Rule[], context: MatchContext, options: MatchOptions = {}): MatchResult {
  const startTime = performance.now();
  const topK = options.topK ?? 10;
  const scored: ScoredRule[] = rules.map(rule => {
    const score = computeScore(rule, context);
    const matchReasons: string[] = [];
    if (rule.language === context.language || rule.language === "*") matchReasons.push("language_match");
    if (rule.tags?.split(",").some(t => context.filePath.toLowerCase().includes(t.trim().toLowerCase()))) matchReasons.push("path_match");
    return { rule, score, matchReasons };
  }).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const topScored = scored.slice(0, topK);
  const { rules: selected, totalTokens, truncated } = truncateRules(topScored.map(s => s.rule), options.maxTokens ?? 2000);
  const resultMap = new Map(topScored.map(s => [s.rule.id, s]));
  const finalScored: ScoredRule[] = selected.map(r => resultMap.get(r.id)).filter((s): s is ScoredRule => s !== undefined);
  return { rules: finalScored, totalTokens, truncated, queryDurationMs: performance.now() - startTime };
}
```

- [ ] **Step 5: 运行全部引擎测试**

Run: `cd D:\Desktop\mcp && npx vitest run tests/engine/`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/engine/rule-matcher.ts src/engine/token-controller.ts tests/engine/rule-matcher.test.ts tests/engine/token-controller.test.ts
git commit -m "feat: implement rule matcher with scoring and token control"
```


### Task 7: 冲突仲裁器

**Files:**
- Create: `D:\Desktop\mcp\src\conflict\arbitrator.ts`
- Create: `tests\conflict\arbitrator.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/conflict/arbitrator.test.ts
import { describe, it, expect } from "vitest";
import { detectConflict, applyResolution } from "../../src/conflict/arbitrator.js";
import { Rule } from "../../src/types.js";

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return { id: "1", type: "replace", pattern: "foo", suggestion: "bar", language: "typescript", priority: 1.0, scope: "project", confidence: "high", source: "auto", status: "active", matchCount: 0, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

describe("Conflict Arbitrator", () => {
  it("should detect conflict when two rules have same type/lang but different suggestions", () => {
    const a = makeRule({ id: "1", pattern: "oldFn", suggestion: "newFn" });
    const b = makeRule({ id: "2", pattern: "oldFn", suggestion: "renamedFn" });
    expect(detectConflict(a, b).hasConflict).toBe(true);
  });
  it("should not conflict for different languages", () => {
    const a = makeRule({ id: "1", language: "go", pattern: "func", suggestion: "def" });
    const b = makeRule({ id: "2", language: "python", pattern: "func", suggestion: "function" });
    expect(detectConflict(a, b).hasConflict).toBe(false);
  });
  it("should not conflict for different types", () => {
    const a = makeRule({ id: "1", type: "replace", pattern: "foo" });
    const b = makeRule({ id: "2", type: "restructure", pattern: "foo" });
    expect(detectConflict(a, b).hasConflict).toBe(false);
  });
  it("should generate arbitration rule after keep_a resolution", () => {
    const a = makeRule({ id: "1", scope: "project", priority: 1.0 });
    const b = makeRule({ id: "2", scope: "user", priority: 0.8 });
    const arb = applyResolution(a, b, "keep_a");
    expect(arb).toBeDefined();
    expect(arb!.source).toBe("arbitration");
  });
  it("should create merge rule", () => {
    const a = makeRule({ pattern: "oldFn()", suggestion: "newFn()" });
    const b = makeRule({ pattern: "oldFn()", suggestion: "safeFn()" });
    const arb = applyResolution(a, b, "merge");
    expect(arb).toBeDefined();
    expect(arb!.type).toBe("convention");
    expect(arb!.confidence).toBe("medium");
  });
});
```

- [ ] **Step 2: 运行测试（预期失败）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/conflict/arbitrator.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现仲裁器**

```typescript
// src/conflict/arbitrator.ts
import { Rule, ConflictResolution, RuleSpec } from "../types.js";

export interface ConflictCheck {
  hasConflict: boolean; reason?: string; scopeKey?: string;
}

export function detectConflict(ruleA: Rule, ruleB: Rule): ConflictCheck {
  if (ruleA.type !== ruleB.type) return { hasConflict: false };
  if (ruleA.language !== ruleB.language) return { hasConflict: false };
  if (ruleA.pattern !== ruleB.pattern) return { hasConflict: false };
  if (ruleA.suggestion === ruleB.suggestion) return { hasConflict: false };
  return {
    hasConflict: true,
    reason: `same scope with different suggestions: "${ruleA.suggestion}" vs "${ruleB.suggestion}"`,
    scopeKey: `${ruleA.scope}:${ruleB.scope}:${ruleA.type}:${ruleA.language}:${ruleA.pattern}`,
  };
}

export function applyResolution(ruleA: Rule, ruleB: Rule, resolution: ConflictResolution): RuleSpec | undefined {
  if (resolution === "keep_a") {
    return { type: ruleA.type, pattern: ruleA.pattern, suggestion: ruleA.suggestion, language: ruleA.language, scope: ruleA.scope, tags: [...new Set([...(ruleA.tags ?? []), ...(ruleB.tags ?? [])])], category: "arbitration", source: "arbitration" };
  }
  if (resolution === "keep_b") {
    return { type: ruleB.type, pattern: ruleB.pattern, suggestion: ruleB.suggestion, language: ruleB.language, scope: ruleB.scope, tags: [...new Set([...(ruleA.tags ?? []), ...(ruleB.tags ?? [])])], category: "arbitration", source: "arbitration" };
  }
  if (resolution === "merge") {
    return { type: "convention", pattern: ruleA.pattern, suggestion: `${ruleA.suggestion}\n// Alternative: ${ruleB.suggestion}`, language: ruleA.language, confidence: "medium", category: "arbitration", source: "arbitration" };
  }
  return undefined;
}
```

- [ ] **Step 4: 运行测试（预期通过）**

Run: `cd D:\Desktop\mcp && npx vitest run tests/conflict/arbitrator.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/conflict/ tests/conflict/
git commit -m "feat: implement conflict detection and arbitration"
```

### Task 8: 双模式处理器

**Files:**
- Create: `D:\Desktop\mcp\src\modes\silent.ts`
- Create: `D:\Desktop\mcp\src\modes\confirm.ts`

- [ ] **Step 1: 实现静默模式**

```typescript
// src/modes/silent.ts
import { AtomicOp, RuleSpec } from "../types.js";
import { evaluateRuleCandidate } from "../engine/rule-generator.js";
import { MetricRepo } from "../storage/metric-repo.js";

export interface SilentModeResult { generatedRule: boolean; ruleSpec?: RuleSpec; notification?: string; }

export async function processSilent(
  ops: AtomicOp[], language: string,
  distinctFiles: number, repeatCount: number, windowDays: number, metricRepo: MetricRepo,
): Promise<SilentModeResult> {
  const evalResult = evaluateRuleCandidate(ops, language, distinctFiles, repeatCount, windowDays);
  await metricRepo.track("silent_mode_process", { opsCount: ops.length, language, generated: evalResult.generate });
  if (!evalResult.generate) return { generatedRule: false };
  return { generatedRule: true, ruleSpec: evalResult.ruleCandidate, notification: `已学习新规则: ${evalResult.ruleCandidate!.type} — ${evalResult.ruleCandidate!.pattern}` };
}
```

- [ ] **Step 2: 实现确认模式**

```typescript
// src/modes/confirm.ts
import { AtomicOp, RuleSpec } from "../types.js";
import { evaluateRuleCandidate } from "../engine/rule-generator.js";
import { MetricRepo } from "../storage/metric-repo.js";

export type ConfirmAction = "accept" | "reject" | "edit" | "skip";

export interface ConfirmCard { title: string; ruleSpec: RuleSpec; actions: ConfirmAction[]; message: string; }

export async function buildConfirmCard(
  ops: AtomicOp[], language: string,
  distinctFiles: number, repeatCount: number, windowDays: number, metricRepo: MetricRepo,
): Promise<{ shouldShow: boolean; card?: ConfirmCard }> {
  const evalResult = evaluateRuleCandidate(ops, language, distinctFiles, repeatCount, windowDays);
  await metricRepo.track("confirm_mode_eval", { opsCount: ops.length, language, generated: evalResult.generate });
  if (!evalResult.generate || !evalResult.ruleCandidate) return { shouldShow: false };
  return {
    shouldShow: true,
    card: {
      title: "检测到新的编码规则候选",
      ruleSpec: evalResult.ruleCandidate,
      actions: ["accept", "reject", "edit", "skip"],
      message: `类型: ${evalResult.ruleCandidate.type}\n模式: ${evalResult.ruleCandidate.pattern}\n建议: ${evalResult.ruleCandidate.suggestion}\n置信度: ${evalResult.ruleCandidate.confidence}`,
    },
  };
}
```

- [ ] **Step 3: 验证编译**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 4: 提交**

```bash
git add src/modes/
git commit -m "feat: implement silent and confirm mode handlers"
```


### Task 9: MCP 工具处理函数

**Files:**
- Create: `D:\Desktop\mcp\src\tools\capture-diff.ts`
- Create: `D:\Desktop\mcp\src\tools\query-rules.ts`
- Create: `D:\Desktop\mcp\src\tools\confirm-rule.ts`
- Create: `D:\Desktop\mcp\src\tools\resolve-conflict.ts`
- Create: `D:\Desktop\mcp\src\tools\list-rules.ts`

- [ ] **Step 1: capture_diff 工具**

```typescript
// src/tools/capture-diff.ts
import { RuleRepo } from "../storage/rule-repo.js";
import { DiffLogRepo } from "../storage/diff-log-repo.js";
import { MetricRepo } from "../storage/metric-repo.js";
import { computeDiffWithFallback } from "../engine/parsers.js";
import { processSilent } from "../modes/silent.js";
import { buildConfirmCard } from "../modes/confirm.js";
import { CaptureDiffInput, RULE_GENERATION_THRESHOLDS } from "../types.js";

function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

export async function handleCaptureDiff(
  input: CaptureDiffInput, ruleRepo: RuleRepo, diffLogRepo: DiffLogRepo,
  metricRepo: MetricRepo, mode: "silent" | "confirm",
) {
  const fileExtension = input.filePath.split(".").pop() ?? "";
  const originalHash = simpleHash(input.originalContent);
  const modifiedHash = simpleHash(input.modifiedContent);
  const diffResult = await computeDiffWithFallback(input.originalContent, input.modifiedContent, input.language);
  await diffLogRepo.create({
    filePath: input.filePath, fileExtension, language: input.language,
    projectId: input.projectId, originalHash, modifiedHash,
    diffContent: JSON.stringify(diffResult.operations),
    astStatus: diffResult.status,
    diffType: diffResult.operations[0]?.type ?? "update",
    operations: JSON.stringify(diffResult.operations),
  });
  const distinctFiles = await diffLogRepo.countDistinctFiles(input.language, originalHash, RULE_GENERATION_THRESHOLDS.repeatWindowDays);
  const repeatCount = await diffLogRepo.countByPattern(input.language, originalHash, RULE_GENERATION_THRESHOLDS.repeatWindowDays);
  if (mode === "silent") {
    const result = await processSilent(diffResult.operations, input.language, distinctFiles, repeatCount, RULE_GENERATION_THRESHOLDS.repeatWindowDays, metricRepo);
    if (result.generatedRule && result.ruleSpec) {
      await ruleRepo.create({ ...result.ruleSpec, projectId: input.projectId });
      await metricRepo.track("rule_auto_generated", { language: input.language });
    }
    return { content: [{ type: "text", text: JSON.stringify({ status: diffResult.status, opCount: diffResult.operations.length, notification: result.notification ?? null }) }] };
  } else {
    const card = await buildConfirmCard(diffResult.operations, input.language, distinctFiles, repeatCount, RULE_GENERATION_THRESHOLDS.repeatWindowDays, metricRepo);
    return { content: [{ type: "text", text: JSON.stringify({ status: diffResult.status, opCount: diffResult.operations.length, confirmCard: card.card ?? null }) }] };
  }
}
```

- [ ] **Step 2: query_rules 工具**

```typescript
// src/tools/query-rules.ts
import { RuleRepo } from "../storage/rule-repo.js";
import { MetricRepo } from "../storage/metric-repo.js";
import { matchRules } from "../engine/rule-matcher.js";
import { QueryRulesInput, MatchContext } from "../types.js";

export async function handleQueryRules(input: QueryRulesInput, ruleRepo: RuleRepo, metricRepo: MetricRepo) {
  const fileExtension = input.filePath.split(".").pop() ?? "";
  const context: MatchContext = { language: input.language, filePath: input.filePath, fileExtension: "." + fileExtension, projectId: input.projectId, ruleTags: input.tags };
  const rules = await ruleRepo.queryByMatch(input.language, "." + fileExtension, input.projectId, input.tags);
  const result = matchRules(rules, context, { topK: 10 });
  for (const sr of result.rules) await ruleRepo.incrementMatchCount(sr.rule.id);
  await metricRepo.track("query_rules", { language: input.language, candidates: rules.length, returned: result.rules.length });
  return { content: [{ type: "text", text: JSON.stringify({ rules: result.rules.map(sr => ({ id: sr.rule.id, type: sr.rule.type, pattern: sr.rule.pattern, suggestion: sr.rule.suggestion, score: sr.score, matchReasons: sr.matchReasons })), totalTokens: result.totalTokens, truncated: result.truncated }) }] };
}
```

- [ ] **Step 3: confirm_rule 工具**

```typescript
// src/tools/confirm-rule.ts
import { RuleRepo } from "../storage/rule-repo.js";
import { MetricRepo } from "../storage/metric-repo.js";
import { ConfirmRuleInput } from "../types.js";

export async function handleConfirmRule(input: ConfirmRuleInput, ruleRepo: RuleRepo, metricRepo: MetricRepo) {
  const rule = await ruleRepo.findById(input.ruleId);
  if (!rule) return { content: [{ type: "text", text: JSON.stringify({ error: "Rule not found" }) }], isError: true };
  switch (input.action) {
    case "accept": await ruleRepo.updateStatus(input.ruleId, "active"); break;
    case "reject": await ruleRepo.updateStatus(input.ruleId, "archived"); break;
    case "edit": await ruleRepo.updateStatus(input.ruleId, "active"); break;
    case "skip": break;
  }
  await metricRepo.track("rule_confirmed", { ruleId: input.ruleId, action: input.action });
  return { content: [{ type: "text", text: JSON.stringify({ success: true, ruleId: input.ruleId, action: input.action }) }] };
}
```

- [ ] **Step 4: resolve_conflict 工具**

```typescript
// src/tools/resolve-conflict.ts
import { ConflictRepo } from "../storage/conflict-repo.js";
import { RuleRepo } from "../storage/rule-repo.js";
import { MetricRepo } from "../storage/metric-repo.js";
import { applyResolution } from "../conflict/arbitrator.js";
import { ResolveConflictInput } from "../types.js";

export async function handleResolveConflict(input: ResolveConflictInput, conflictRepo: ConflictRepo, ruleRepo: RuleRepo, metricRepo: MetricRepo) {
  const conflict = await conflictRepo.findById(input.conflictId);
  if (!conflict) return { content: [{ type: "text", text: JSON.stringify({ error: "Conflict not found" }) }], isError: true };
  const ruleA = await ruleRepo.findById(conflict.ruleAId);
  const ruleB = await ruleRepo.findById(conflict.ruleBId);
  if (!ruleA || !ruleB) return { content: [{ type: "text", text: JSON.stringify({ error: "Referenced rule not found" }) }], isError: true };
  const arbitration = applyResolution(ruleA, ruleB, input.resolution);
  await conflictRepo.resolve(input.conflictId, input.resolution);
  if (arbitration) await ruleRepo.create({ ...arbitration, projectId: ruleA.projectId });
  if (input.batchAllSession) await conflictRepo.setBatchChoice(input.conflictId, "session:" + input.resolution);
  await metricRepo.track("conflict_resolved", { conflictId: input.conflictId, resolution: input.resolution });
  return { content: [{ type: "text", text: JSON.stringify({ success: true, resolution: input.resolution, arbitrationCreated: !!arbitration }) }] };
}
```

- [ ] **Step 5: list_rules 工具**

```typescript
// src/tools/list-rules.ts
import { RuleRepo } from "../storage/rule-repo.js";
import { ListRulesInput } from "../types.js";

export async function handleListRules(input: ListRulesInput, ruleRepo: RuleRepo) {
  const rules = await ruleRepo.list({ language: input.language, scope: input.scope, status: input.status, projectId: input.projectId, limit: input.limit, offset: input.offset });
  return { content: [{ type: "text", text: JSON.stringify({ rules: rules.map(r => ({ id: r.id, type: r.type, pattern: r.pattern, suggestion: r.suggestion, language: r.language, scope: r.scope, priority: r.priority, status: r.status, matchCount: r.matchCount, createdAt: r.createdAt })), total: rules.length }) }] };
}
```

- [ ] **Step 6: 验证编译**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 7: 提交**

```bash
git add src/tools/
git commit -m "feat: implement MCP tool handlers"
```

### Task 10: MCP Server 入口 + 集成验证

**Files:**
- Create: `D:\Desktop\mcp\src\index.ts`

- [ ] **Step 1: MCP Server 入口**

```typescript
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getPrismaClient, disconnectPrisma } from "./storage/client.js";
import { RuleRepo } from "./storage/rule-repo.js";
import { DiffLogRepo } from "./storage/diff-log-repo.js";
import { ConflictRepo } from "./storage/conflict-repo.js";
import { MetricRepo } from "./storage/metric-repo.js";
import { handleCaptureDiff } from "./tools/capture-diff.js";
import { handleQueryRules } from "./tools/query-rules.js";
import { handleConfirmRule } from "./tools/confirm-rule.js";
import { handleResolveConflict } from "./tools/resolve-conflict.js";
import { handleListRules } from "./tools/list-rules.js";

const server = new Server({ name: "agent-tuning-reverse-graph", version: "0.1.0" }, { capabilities: { tools: {} } });
const ruleRepo = new RuleRepo();
const diffLogRepo = new DiffLogRepo();
const metricRepo = new MetricRepo();
const conflictRepo = new ConflictRepo(ruleRepo);

async function getMode(): Promise<"silent" | "confirm"> {
  const prisma = getPrismaClient();
  const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  return (config?.mode as "silent" | "confirm") ?? "silent";
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "capture_diff", description: "分析代码差异并生成规则候选", inputSchema: { type: "object", properties: { filePath: { type: "string" }, originalContent: { type: "string" }, modifiedContent: { type: "string" }, language: { type: "string" }, projectId: { type: "string" } }, required: ["filePath", "originalContent", "modifiedContent", "language"] } },
    { name: "query_rules", description: "查询与当前上下文最相关的规则", inputSchema: { type: "object", properties: { language: { type: "string" }, filePath: { type: "string" }, projectId: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["language", "filePath"] } },
    { name: "confirm_rule", description: "确认/拒绝/编辑/跳过规则候选", inputSchema: { type: "object", properties: { ruleId: { type: "string" }, action: { type: "string", enum: ["accept", "reject", "edit", "skip"] }, editedPattern: { type: "string" }, editedSuggestion: { type: "string" } }, required: ["ruleId", "action"] } },
    { name: "resolve_conflict", description: "解决规则冲突", inputSchema: { type: "object", properties: { conflictId: { type: "string" }, resolution: { type: "string", enum: ["keep_a", "keep_b", "merge", "skip"] }, batchAllSession: { type: "boolean" } }, required: ["conflictId", "resolution"] } },
    { name: "list_rules", description: "列出规则", inputSchema: { type: "object", properties: { language: { type: "string" }, scope: { type: "string", enum: ["project", "user", "global"] }, status: { type: "string", enum: ["active", "pending", "archived"] }, projectId: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "capture_diff": return await handleCaptureDiff(args as any, ruleRepo, diffLogRepo, metricRepo, await getMode());
      case "query_rules": return await handleQueryRules(args as any, ruleRepo, metricRepo);
      case "confirm_rule": return await handleConfirmRule(args as any, ruleRepo, metricRepo);
      case "resolve_conflict": return await handleResolveConflict(args as any, conflictRepo, ruleRepo, metricRepo);
      case "list_rules": return await handleListRules(args as any, ruleRepo);
      default: throw new McpError(ErrorCode.MethodNotFound, "Unknown tool: " + name);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }], isError: true };
  }
});

async function main() {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe("SELECT 1");
  await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default", mode: "silent" } });
  const transport = new StdioServerTransport();
  server.onerror = (err) => console.error("[MCP Error]", err);
  process.on("SIGINT", async () => { await disconnectPrisma(); process.exit(0); });
  process.on("SIGTERM", async () => { await disconnectPrisma(); process.exit(0); });
  await server.connect(transport);
  console.error("Agent Tuning Reverse Graph MCP Server running on stdio");
}

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
```

- [ ] **Step 2: 验证编译**

Run: `cd D:\Desktop\mcp && npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 3: 运行全部测试**

Run: `cd D:\Desktop\mcp && npx vitest run`
Expected: 全部测试通过

- [ ] **Step 4: 编译构建**

Run: `cd D:\Desktop\mcp && npx tsc`
Expected: dist/ 目录生成

- [ ] **Step 5: 最终提交**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point and wire up tools"
```

---

## 自检清单

### Spec 覆盖
- Task 1 — 项目脚手架、Prisma Schema、SQLite 配置
- Task 2 — 共享类型定义（ASTNode, Rule, MatchContext, ConflictInfo 等）
- Task 3 — Prisma 客户端 + 四个仓库
- Task 4 — AST Diff 引擎（节点签名映射 + UPDATE/DELETE/INSERT 检测 + 正则降级）
- Task 5 — 规则生成器（≥3 文件 / ≥5 次阈值 + 置信度判定）
- Task 6 — 规则匹配器（加权打分 Top-K）+ Token 控制（≤2000 tokens）
- Task 7 — 冲突仲裁器（冲突检测 + keep_a/keep_b/merge/skip 决议）
- Task 8 — 静默/确认双模式
- Task 9 — 五个 MCP 工具 handlers
- Task 10 — MCP Server 入口

### 类型一致性
- RuleSpec, Rule, AtomicOp, DiffResult, MatchContext, ScoredRule 等类型全部在 Task 2 中定义
- ConflictResolution 枚举在 types.ts 中定义为 "keep_a" | "keep_b" | "merge" | "skip"
- TOKEN_LIMITS.maxInjectionTokens = 2000 在 types.ts 中定义
- evaluateRuleCandidate 签名在 Task 5 中定义，Task 8/9 一致调用
- ConflictRepo.findById 在 Task 3 中定义，resolve_conflict 在 Task 9 中使用

### 验收条件
- [ ] MCP Server 内存占用 ≤ 300MB
- [ ] 单次 query_rules P99 延迟 ≤ 50ms
- [ ] AST Diff 单次处理 ≤ 200ms（1000 行以内）
- [ ] 规则生成准确率 ≥ 95%
- [ ] P99 延迟 ≤ 50ms（SQLite WAL 模式 + 内存缓存）
- [ ] 弹窗 ≤ 2次/小时
- [ ] 规则遵循率 ≥ 95%
- [ ] 人工抽检准确率 ≥ 95%


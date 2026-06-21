# Governflow Agent 工作流指南

以 AI Agent 为主体，完成 **知识注入 → 规则写码 → 代码审计** 三步闭环。所有命令均通过 MCP 工具调用。

---

## 目录

- [流程总览](#流程总览)
- [流程 1：联网搜索 + 知识注入](#流程-1联网搜索--知识注入)
- [流程 2：根据图谱 + 规则写代码](#流程-2根据图谱--规则写代码)
- [流程 3：代码审计](#流程-3代码审计)
- [高级用法](#高级用法)
- [命令速查表](#命令速查表)

---

## 流程总览

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   1. 知识注入     │ ──→ │   2. 规则写码     │ ──→ │   3. 代码审计     │
│                  │     │                  │     │                  │
│ 联网搜索         │     │ 查询知识库       │     │ analyze_workspace │
│ capture_diff     │     │ query_rules      │     │ list_rules       │
│ cognition_feedback│    │ cognition_query  │     │ confirm_rule     │
│                  │     │ 写代码           │     │ resolve_conflict  │
│                  │     │ capture_diff     │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                        │
        └──────── 知识持续沉淀到认知图 + 规则库 ────────────┘
```

---

## 流程 1：联网搜索 + 知识注入

**目的**: 将外部知识（官方文档、开源范例、最佳实践）注入认知图，形成可检索的语义节点。

### 步骤 1.1：联网搜索知识

Agent 联网搜索目标主题，获取代码范例、API 用法、设计模式等内容。

### 步骤 1.2：写入认知图

通过 `capture_diff` 将搜索到的知识写入认知图。对于全新知识，`originalContent` 为空字符串：

```
capture_diff({
  filePath: "docs/knowledge/<主题名>.ts",
  originalContent: "",
  modifiedContent: "// 联网搜索到的代码范例/知识片段/设计模式",
  language: "typescript",
  projectId: "<当前项目>"
})
```

**返回值关键字段**:
- `cognition.patternNodeId` — PATTERN 节点 ID（代码范例）
- `cognition.intentNodeId` — INTENT 节点 ID（意图分类：REFACTOR / BUGFIX / FEATURE）
- `cognition.edgeCreated` — CAUSES 边是否创建成功

### 步骤 1.3：验证注入结果

```
cognition_query({ nodeType: "PATTERN" })       // 按类型查
cognition_query({ language: "typescript" })     // 按语言查
cognition_query({ filePath: "docs/knowledge/<主题名>.ts" })  // 按文件查
```

### 步骤 1.4：反馈调优（可选）

对注入的节点标记质量，调整后续匹配权重：

```
cognition_feedback({
  nodeId: "<步骤 1.2 返回的 patternNodeId>",
  outcome: "ACCEPTED",
  comment: "来源: xxx 官方文档 v3.2"
})
```

outcome 可选值：`ACCEPTED`（提高权重）/ `REJECTED`（降低权重）/ `MODIFIED`（记录修改）

---

## 流程 2：根据图谱 + 规则写代码

**目的**: 写代码前先查询已有知识和规则，写完后自动沉淀为新知识。

### 步骤 2.1：查询目标文件相关规则

```
query_rules({
  language: "typescript",
  filePath: "src/xxx/feature.ts"
})
```

返回匹配的规则列表，每条包含 `pattern`（触发条件）和 `suggestion`（建议写法）。

### 步骤 2.2：查询认知图已有知识

```
cognition_query({ language: "typescript" })     // 查 TypeScript 相关知识
cognition_query({ nodeType: "PATTERN" })         // 查所有代码范例
```

根据返回的节点内容，参考已有范例和约束进行编码。

### 步骤 2.3：写完代码后沉淀

将编码前后的 diff 写入认知图，自动生成 PATTERN + INTENT + CAUSES 结构：

```
capture_diff({
  filePath: "src/xxx/feature.ts",
  originalContent: "// 写之前的代码（新文件传空字符串）",
  modifiedContent: "// 写完的最终代码",
  language: "typescript",
  projectId: "<当前项目>"
})
```

### 步骤 2.4：确认生成的规则建议

写码过程中产生的规则建议需要人工确认：

```
confirm_rule({ ruleId: "<rule-id>", action: "accept" })   // 认可规则
confirm_rule({ ruleId: "<rule-id>", action: "reject" })   // 驳回误报
confirm_rule({ ruleId: "<rule-id>", action: "skip" })      // 跳过，稍后处理
```

---

## 流程 3：代码审计

**目的**: 扫描代码变更中的规则违规，逐条确认或驳回，持续优化规则库。

### 步骤 3.1：分析当前工作区

```
analyze_workspace({ baseCommit: "HEAD~1" })
```

可选参数：
- `headCommit` — 指定目标提交（默认最新）
- `paths` — 限定扫描目录，如 `["src/analysis/"]`
- `taskId` — 关联任务 ID

返回内容包含：
- 每个文件的意图分类（REFACTOR / BUGFIX / FEATURE）
- 检测到的规则违规
- 自动生成的新规则建议

### 步骤 3.2：查看发现的规则

```
list_rules({ status: "active" })                                    // 全量活跃规则
query_rules({ language: "typescript", filePath: "src/xxx.ts" })     // 特定文件相关规则
```

### 步骤 3.3：逐条处理违规

```
confirm_rule({ ruleId: "<id>", action: "accept" })    // 认可这条建议
confirm_rule({ ruleId: "<id>", action: "reject" })    // 驳回误报
confirm_rule({ ruleId: "<id>", action: "edit", editedPattern: "修正后的 pattern", editedSuggestion: "修正后的建议" })
```

### 步骤 3.4：解决规则冲突（如有多条规则互相矛盾）

```
resolve_conflict({
  conflictId: "<conflict-id>",
  resolution: "keep_a"              // 保留规则 A
  // resolution: "keep_b"           // 保留规则 B
  // resolution: "merge"            // 合并两条规则
  // resolution: "skip"             // 跳过
})
```

批量解决本次会话所有冲突：

```
resolve_conflict({
  conflictId: "<conflict-id>",
  resolution: "merge",
  batchAllSession: true
})
```

### 步骤 3.5：审计期间暂停/回滚（可选）

审计大段代码时暂停自动仲裁，避免干扰：

```
governance_pause_arbitrator({ minutes: 30 })    // 暂停 30 分钟
```

发现误判后回滚：

```
governance_rollback_arbitration({ since: "2026-06-21T10:00:00Z" })
```

---

## 高级用法

### 认知图校验

校验目标代码是否符合认知图中某个节点的模板：

```
cognition_validate({
  nodeId: "<node-id>",
  targetFileContent: "// 待校验的代码内容"
})
```

### 认知注入审批

当 Governflow 自动提出知识注入提案时，进行审批：

```
cognition_approve_injection({ proposalId: "<proposal-id>", decision: "APPROVE" })
cognition_approve_injection({ proposalId: "<proposal-id>", decision: "REJECT" })
cognition_approve_injection({ proposalId: "<proposal-id>", decision: "OVERRIDE" })
```

### 切换认知模式

```
cognition_update_config({ mode: "silent" })    // 静默模式，自动执行
cognition_update_config({ mode: "confirm" })   // 确认模式，需人工审批
```

---

## 命令速查表

| 阶段 | 工具 | 用途 | 必填参数 |
|------|------|------|---------|
| 知识注入 | `capture_diff` | 写入认知图 | `filePath`, `originalContent`, `modifiedContent`, `language` |
| 知识注入 | `cognition_feedback` | 质量反馈调优 | `nodeId`, `outcome` |
| 知识注入 | `cognition_query` | 验证注入结果 | `contextHash` / `nodeType` / `filePath` / `language` (任选一) |
| 规则写码 | `query_rules` | 查询相关规则 | `language`, `filePath` |
| 规则写码 | `list_rules` | 分页查看规则 | 无（全部可选） |
| 规则写码 | `confirm_rule` | 确认/驳回规则 | `ruleId`, `action` |
| 代码审计 | `analyze_workspace` | 分析 git diff | `baseCommit` |
| 代码审计 | `resolve_conflict` | 解决规则冲突 | `conflictId`, `resolution` |
| 代码审计 | `governance_pause_arbitrator` | 暂停自动仲裁 | `minutes` |
| 代码审计 | `governance_rollback_arbitration` | 回滚仲裁 | `since` |
| 高级 | `cognition_validate` | 代码 vs 模板校验 | `nodeId`, `targetFileContent` |
| 高级 | `cognition_approve_injection` | 审批注入提案 | `proposalId`, `decision` |
| 高级 | `cognition_update_config` | 切换认知模式 | `mode` |

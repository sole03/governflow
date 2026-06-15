# Phase 4 — MCP 工具与反馈闭环设计文档

> **日期:** 2026-06-15
> **项目:** MCP Rule Engine → Cognition Engine Refactoring

---

## 1. 新增 MCP Tools

三个新工具注册在 MCP Server 的 `ListToolsRequestSchema` 中，与 Legacy Engine 的 6 个工具完全独立、共存。

### 1.1 cognition_query

| 属性 | 值 |
|------|-----|
| 名称 | `cognition_query` |
| 描述 | 主动查询认知图谱并召回关联认知节点 |
| 输入 | `contextHash` (string, required), `intentHint` (string enum, optional), `maxDepth` (number, optional) |
| 输出 | `{ nodes: [{id, type, abstractionLevel, relevanceScore}], traversalMs, truncated }` |

**内部逻辑:**
1. 使用 `contextHash` 直接匹配认知图谱节点（跳过 hash 计算）
2. 若提供 `intentHint`，则作为遍历偏置传入 GraphTraverser
3. 加权 BFS 遍历子图，返回排序后的节点摘要
4. **异步（fire-and-forget）** 记录 PENDING 反馈事件

### 1.2 cognition_validate

| 属性 | 值 |
|------|-----|
| 名称 | `cognition_validate` |
| 描述 | 对文件内容执行 AST 级约束校验 |
| 输入 | `nodeId` (string, required), `targetFileContent` (string, required) |
| 输出 | `{ valid: boolean, violations: [{constraintPath, expected, actual}], transformPatch? }` |

**内部逻辑:**
1. 根据 `nodeId` 查找 CognitionNode
2. 获取关联的 AstTemplate.templateDsl
3. 调用 `solveConstraints()` 对目标文件内容执行 AST 约束求解
4. 返回校验结果

### 1.3 cognition_feedback

| 属性 | 值 |
|------|-----|
| 名称 | `cognition_feedback` |
| 描述 | 接收 Agent 执行结果反馈，更新节点权重与边强度 |
| 输入 | `nodeId` (required), `edgeId` (optional), `outcome` (ACCEPTED/REJECTED/MODIFIED, required), `comment` (optional) |
| 输出 | `{ updatedWeight: number|null, feedbackId: string }` |

**内部逻辑:**
1. 根据 `outcome` 计算权重增量：ACCEPTED=+0.1, REJECTED=-0.2, MODIFIED=+0.05
2. 若提供 `edgeId`，调用 updateEdgeWeight() 调整边权重
3. 调用 `recordFeedbackEvent()` 记录反馈事件
4. 调用 `resolveFeedbackEvent()` 更新事件状态

---

## 2. 反馈闭环机制

### 2.1 数据流

```
cognition_query ---> recordFeedbackEvent(PENDING)
       |
       v
  Agent 处理结果
       |
       v
cognition_feedback ---> resolveFeedbackEvent(RESOLVED)
                        |--- outcome=ACCEPTED/REJECTED/MODIFIED
                        v
                  updateEdgeWeight(delta)
                        |
                        v （下一次查询）
                  cognition_query 使用更新后的权重
```

### 2.2 事件存储

使用现有的 `MetricEvent` 表（不新增 Prisma Model）:
- `eventType`: `"cognition_feedback_pending"` (初始)
- `properties`: JSON 字符串，包含 `{nodeId, edgeId, outcome, status, comment}`

### 2.3 异步非阻塞保证

- `recordFeedbackEvent()` 在 query/validate 响应发送后调用
- 调用方式为 `repo.recordFeedbackEvent(...).catch(() => {})`
- 不阻塞主工具响应路径

---

## 3. 向后兼容性

| 方面 | 保证 |
|------|------|
| Legacy 工具 | 6 个原始工具完全不变 |
| 工具注册 | 新工具追加在原有数组末尾 |
| Switch 路由 | 新 case 加在 default 前 |
| Import | 新文件 `cognition-tools.ts` 物理隔离 |

---

## 4. 测试覆盖

| 测试套件 | 测试数 | 说明 |
|---------|-------|------|
| cognition_query | 2 | 错误输入 + 正常路径 |
| cognition_validate | 3 | 缺失字段 + 节点不存在 |
| cognition_feedback | 4 | 错误输入 + 三种 outcome |
| 原有测试 | 85 | 无回归 |
| **总计** | **94+** | |

---

## 5. Tool Schema 定义

### cognition_query
```json
{
  "type": "object",
  "properties": {
    "contextHash": { "type": "string" },
    "intentHint": { "type": "string", "enum": ["REFACTOR", "BUGFIX", "BOILERPLATE"] },
    "maxDepth": { "type": "number" }
  },
  "required": ["contextHash"]
}
```

### cognition_validate
```json
{
  "type": "object",
  "properties": {
    "nodeId": { "type": "string" },
    "targetFileContent": { "type": "string" }
  },
  "required": ["nodeId", "targetFileContent"]
}
```

### cognition_feedback
```json
{
  "type": "object",
  "properties": {
    "nodeId": { "type": "string" },
    "edgeId": { "type": "string" },
    "outcome": { "type": "string", "enum": ["ACCEPTED", "REJECTED", "MODIFIED"] },
    "comment": { "type": "string" }
  },
  "required": ["nodeId", "outcome"]
}
```

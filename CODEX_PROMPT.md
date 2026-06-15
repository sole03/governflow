## 反向图谱系统集成指令

当你完成代码修改后，**必须**执行以下步骤：

1. 调用 `analyze_workspace` 工具，传入当前 git base commit
2. 如果返回了新生成的规则，用 `confirm_rule` 确认高置信度项
3. 如果返回了冲突，用 `resolve_conflict` 选择 keep_a/keep_b/merge/skip
4. 在下一次修改前，先调用 `query_rules` 检查是否有可复用的模式

注意：所有工具调用均通过 MCP 协议，参数格式见 docs/api/README.md

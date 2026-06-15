import { RuleRepo } from "../storage/rule-repo.js";
import { MetricRepo } from "../storage/metric-repo.js";
import { matchRules } from "../engine/rule-matcher.js";
import { truncateRules } from "../engine/token-controller.js";
import { QueryRulesInput, MatchContext } from "../types.js";

export async function handleQueryRules(input: QueryRulesInput, ruleRepo: RuleRepo, metricRepo: MetricRepo) {
  const ext = input.filePath.split(".").pop() ?? "";
  const ctx: MatchContext = { language: input.language, filePath: input.filePath, fileExtension: "." + ext, projectId: input.projectId, ruleTags: input.tags };
  const rules = await ruleRepo.queryByMatch(input.language, "." + ext, input.projectId, input.tags);
  const result = matchRules(rules, ctx, { topK: 10 });
  if (input.taskId) {
    const sess = truncateRules(result.rules.map(s => s.rule), 2000, input.taskId);
    result.rules = result.rules.filter(sr => sess.rules.some(s => s.id === sr.rule.id));
    result.totalTokens = sess.totalTokens;
    result.truncated = sess.truncated;
  }
  for (const sr of result.rules) await ruleRepo.incrementMatchCount(sr.rule.id);
  await metricRepo.track("query_rules", { language: input.language, candidates: rules.length, returned: result.rules.length });
  return { content: [{ type: "text", text: JSON.stringify({ rules: result.rules.map(sr => ({ id: sr.rule.id, type: sr.rule.type, pattern: sr.rule.pattern, suggestion: sr.rule.suggestion, score: sr.score, matchReasons: sr.matchReasons })), totalTokens: result.totalTokens, truncated: result.truncated }) }] };
}

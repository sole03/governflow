import { Rule, TOKEN_LIMITS } from "../types.js";
 
 /** Session-level token tracking keyed by taskId */
 const sessionTokens = new Map<string, number>();
 
 export function getSessionTokens(taskId: string): number {
   return sessionTokens.get(taskId) ?? 0;
 }
 
 export function addSessionTokens(taskId: string, tokens: number): number {
   const current = sessionTokens.get(taskId) ?? 0;
   const updated = current + tokens;
   sessionTokens.set(taskId, updated);
   return updated;
 }
 
 export function clearSession(taskId: string): void {
   sessionTokens.delete(taskId);
 }

export function estimateTokens(text: string): number {
  const bytes = new TextEncoder().encode(text).length;
  return Math.ceil(bytes / 3.5);
}

function formatRule(r: Rule): string {
  const tagsStr = r.tags?.length ? " [" + r.tags.join(", ") + "]" : "";
  const extStr = r.fileExtensions?.length ? " (files: " + r.fileExtensions.join(", ") + ")" : "";
  return `[${r.type}] ${r.pattern} → ${r.suggestion}${extStr}${tagsStr}${r.priority !== 1.0 ? " priority:" + r.priority : ""}`;
}

export function truncateRules(rules: Rule[], maxTokens: number = TOKEN_LIMITS.maxInjectionTokens, taskId?: string) {
  let totalTokens = 0;
  const selected: Rule[] = [];
  const sessionUsed = taskId ? getSessionTokens(taskId) : 0;
  const budget = Math.min(maxTokens, TOKEN_LIMITS.maxInjectionTokens) - sessionUsed;
  if (budget <= 0) return { rules: [], totalTokens: 0, truncated: true };
  for (const rule of rules) {
    const formatted = formatRule(rule);
    const tokens = estimateTokens(formatted);
    if (tokens > TOKEN_LIMITS.maxSingleRuleTokens) continue;
    if (totalTokens + tokens > budget) break;
    selected.push(rule);
    totalTokens += tokens;
  }
  if (taskId && totalTokens > 0) addSessionTokens(taskId, totalTokens);
  return { rules: selected, totalTokens, truncated: selected.length < rules.length };
}

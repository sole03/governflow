/**
 * @file Response Validation Middleware
 * Validates tools/call responses for Schema compliance.
 * Auto-adds validationRequired if missing, logs WARN.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "../../logs");

export function validateToolResponse(toolName: string, response: { content: { type: string; text: string }[] }): { content: { type: string; text: string }[] } {
  try {
    for (const item of response.content) {
      if (item.type !== "text") continue;
      const data = JSON.parse(item.text);
      if ((toolName === "cognition_query" || toolName === "cognition_validate") && data.validationRequired === undefined) {
        data.validationRequired = true;
        item.text = JSON.stringify(data);
        logWarn("Auto-patched validationRequired for " + toolName);
      }
    }
  } catch { /* non-JSON content */ }
  return response;
}

function logWarn(msg: string): void {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    writeFileSync(join(LOG_DIR, "validation-warnings.log"), "[" + new Date().toISOString() + "] WARN: " + msg + "\n", { flag: "a" });
  } catch { /* silent */ }
}

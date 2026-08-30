/**
 * Redact Secrets Hook
 * Runs after Bash commands in security-scanning skill
 * Warns if potential secrets detected in output
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

// API key patterns
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/, // OpenAI
  /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
  /gl(?:pat|ptt|dt|rt|oas|agent|imt|soat|cbt|ft|ffct)-[a-zA-Z0-9_-]{20,}/, // GitLab tokens (#3589)
  /AKIA[A-Z0-9]{16}/, // AWS Access Key
  /xox[baprs]-[a-zA-Z0-9-]+/, // Slack tokens
  /tvly-[a-zA-Z0-9-]{10,}/, // Tavily API key
  /m0-[a-zA-Z0-9]{10,}/, // Mem0 API key
];

// Generic secret patterns
const SECRET_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /secret\s*[:=]\s*['"][^'"]+['"]/i,
];

/**
 * Check for potential secrets in command output
 */
export function redactSecrets(input: HookInput, _ctx: HookContext = NOOP_CTX): HookResult {
  // `tool_response` is what CC sends on PostToolUse; `tool_result` / `output`
  // are the legacy aliases (types.ts, same read order as
  // posttool/secret-handler.ts). Reading only the aliases meant toolOutput
  // came back empty on every real payload and this layer scanned nothing
  // (#3725).
  const toolOutput =
    (input as any).tool_response || (input as any).tool_result || (input as any).output || '';

  if (!toolOutput) return outputSilentSuccess();

  // Check for API key patterns
  for (const pattern of API_KEY_PATTERNS) {
    if (pattern.test(toolOutput)) {
      process.stderr.write('::warning::Potential API key detected in output - verify redaction\n');
      break;
    }
  }

  // Check for generic secret patterns
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(toolOutput)) {
      process.stderr.write('::warning::Potential hardcoded credential in output\n');
      break;
    }
  }

  // Silent success — warnings go to stderr (works in async hooks, unlike systemMessage).
  // Async PostToolUse hooks cannot use additionalContext/systemMessage (CC ignores them).
  return outputSilentSuccess();
}

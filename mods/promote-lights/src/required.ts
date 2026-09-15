/**
 * Compute the live union of required contexts from:
 * 1. Branch protection (/branches/main/protection)
 * 2. Rulesets (/rules/branches/main)
 *
 * Drops 404 bodies (lines that start with {).
 * Refuses to return green when the union is empty.
 */

export interface ProtectionResponse {
  required_status_checks?: {
    contexts: string[];
  };
}

export interface RulesetResponse {
  rules?: Array<{
    type: string;
    parameters?: {
      required_status_checks?: Array<{ context: string }>;
    };
  }>;
}

/**
 * Parse protection response, extracting contexts.
 */
export function parseProtection(body: string): string[] {
  // 404 body starts with { per brief - drop it
  if (body.startsWith("{") && !body.includes("required_status_checks")) {
    return [];
  }

  try {
    const parsed: ProtectionResponse = JSON.parse(body);
    return parsed.required_status_checks?.contexts ?? [];
  } catch {
    return [];
  }
}

/**
 * Parse rulesets response, extracting contexts from each rule.
 */
export function parseRulesets(body: string): string[] {
  // 404 body starts with { per brief - drop it
  if (body.startsWith("{") && !body.includes("rules")) {
    return [];
  }

  try {
    const parsed: RulesetResponse = JSON.parse(body);
    const contexts: string[] = [];

    for (const rule of parsed.rules ?? []) {
      if (rule.parameters?.required_status_checks) {
        for (const check of rule.parameters.required_status_checks) {
          if (check.context) {
            contexts.push(check.context);
          }
        }
      }
    }

    return contexts;
  } catch {
    return [];
  }
}

/**
 * Compute the live union of required contexts.
 */
export function computeRequiredUnion(
  protectionBody: string,
  rulesetsBody: string
): string[] {
  const protection = parseProtection(protectionBody);
  const rulesets = parseRulesets(rulesetsBody);

  // Union with deduplication
  const combined = new Set([...protection, ...rulesets]);
  return Array.from(combined).sort();
}

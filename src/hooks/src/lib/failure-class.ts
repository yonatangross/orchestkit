/**
 * PostToolUseFailure error classifier (closed enum, no text out).
 *
 * CC sends a PostToolUseFailure payload whose `error` is free text (no code,
 * no class), plus an optional `is_interrupt` flag that is true when the
 * failure was an abort rather than a tool error. Telemetry needs a countable
 * signal per failure, but the text can hold commands, file paths, secrets
 * and client data, so it must never leave the process.
 *
 * classifyToolFailure() reads the text in memory only to pick one value from
 * the closed FAILURE_CLASSES list. It returns the class and nothing else: no
 * substring, no match, no length. Unknown or empty input is "other", never
 * dropped. Order matters: the first matching rule wins, most specific first.
 */

export const FAILURE_CLASSES = [
  'interrupted',
  'user_rejected',
  'guard_refusal',
  'sandbox_denied',
  'permission_denied',
  'rate_limit',
  'timeout',
  'network',
  'edit_conflict',
  'not_found',
  'invalid_input',
  'parse_error',
  'nonzero_exit',
  'other',
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

/** Schema version of the error_class field on telemetry failure records. */
export const ERROR_CLASS_SCHEMA_VERSION = 1;

const RULES: ReadonlyArray<readonly [Exclude<FailureClass, 'interrupted' | 'other'>, RegExp]> = [
  ['user_rejected', /user doesn't want to (?:proceed|take this action)|user (?:rejected|declined|denied) (?:this|the) tool|tool use was rejected|request interrupted by user/i],
  ['guard_refusal', /\bhook (?:error|denied|blocked)|hook error:|blocked by (?:a )?hook|PreToolUse:\w+ hook|^Blocked:|withheld its result|returned updatedInput that the tool refused|\bguard\b.*\b(?:refus|den|block)|(?:refus|den|block)\w*\b.*\bguard\b/i],
  ['sandbox_denied', /sandbox|operation not permitted|seatbelt/i],
  ['rate_limit', /rate.?limit|\b429\b|too many requests|quota exceeded|overloaded/i],
  ['permission_denied', /permission (?:to use \S+ )?(?:has been |was )?denied|permission denied|EACCES|EPERM|not allowed by (?:the )?permission|auto mode classifier|\b403\b|forbidden/i],
  ['timeout', /timed? ?out|timeout|ETIMEDOUT|deadline exceeded/i],
  ['network', /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|network (?:error|unreachable)|could not resolve host|fetch failed|ConnectError|ConnectTimeout|socket hang up|connection (?:refused|reset)/i],
  ['edit_conflict', /string to replace not found|found \d+ matches of the string to replace|file has not been read yet|file has been (?:modified|changed) since (?:it was )?read|old_string and new_string are (?:exactly )?the same|must read (?:the )?file before/i],
  ['not_found', /ENOENT|no such file|does not exist|not found|cannot find|could not find|unknown (?:command|agent|skill|tool)|no such tool|no matches/i],
  ['invalid_input', /InputValidationError|invalid (?:input|argument|parameter|params|uuid)|category: validation|missing required|is required|must be (?:a|an|one of)|unexpected (?:argument|option)|unknown option/i],
  ['parse_error', /syntax ?error|parse error|unexpected token|unexpected end of|invalid json|JSON\.parse|malformed/i],
  ['nonzero_exit', /exit (?:code|status) [1-9]\d*|exited with (?:code )?[1-9]|command failed|non-?zero exit/i],
];

/** Shape the classifier reads. Every field is optional on purpose. */
export interface FailureClassInput {
  error?: unknown;
  is_interrupt?: unknown;
}

/**
 * Map a PostToolUseFailure payload to one fixed class.
 * Pure: no I/O, no logging, returns only a member of FAILURE_CLASSES.
 */
export function classifyToolFailure(input: FailureClassInput | null | undefined): FailureClass {
  if (!input) return 'other';
  if (input.is_interrupt === true) return 'interrupted';
  const text = typeof input.error === 'string' ? input.error : '';
  if (text.length === 0) return 'other';
  for (const [cls, re] of RULES) {
    if (re.test(text)) return cls;
  }
  return 'other';
}

/** Type guard for readers of telemetry records. */
export function isFailureClass(value: unknown): value is FailureClass {
  return typeof value === 'string' && (FAILURE_CLASSES as ReadonlyArray<string>).includes(value);
}

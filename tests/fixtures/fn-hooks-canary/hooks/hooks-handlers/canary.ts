// Fixture only. Never loaded at runtime; `claude plugin validate` parses it statically.
// Each registration below pins one fact measured on CC 2.1.263 (orchestkit#3917).
import type { Register } from "claude-code";

export const register: Register = (on) => {
  // Pins: `tool.call` exists and carries a matcher.
  on("tool.call", { tool: "Bash" }, async ($, e, next) => next(e));

  // Pins: bare `PreToolUse` is the one legacy name the validator accepts.
  on("PreToolUse", {}, async ($, e, next) => next(e));

  // Pins: these lifecycle nouns exist. If upstream adds `session.stop` or
  // similar, this fixture keeps passing; the assertion in CI is what notices.
  on("session.start", {}, async ($, e, next) => next(e));
  on("engine.create", {}, async ($, e, next) => next(e));

  // Pins the `$` surface names we would migrate onto first. Note the validator
  // reports these without checking they exist, so this is a naming pin, not an
  // existence proof. `$.ui.log` is absent inside engine.create (measured).
  on("prompt.submit", {}, async ($, e, next) => {
    $.ui.log("canary");
    return next(e);
  });
};

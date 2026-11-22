// Fixture only. Never loaded at runtime; `claude plugin validate` parses it statically.
// Each registration below pins one fact, first measured on CC 2.1.263,
// re-measured on 2.1.270, and re-measured on 2.1.330 (orchestkit#3917, #5333).
import type { Register } from "claude-code";

export const register: Register = (on) => {
  // Pins: `tool.call` exists and carries a matcher.
  on("tool.call", { tool: "Bash" }, async ($, e, next) => next(e));

  // Pins: the legacy shell-hook bridge is addressed as `classic.<Event>`. Bare
  // `PreToolUse` was accepted through 2.1.263 and is "not an event" from 2.1.266;
  // negative/bare-pretooluse.ts pins that rejection. The validator checks shape,
  // not membership, so the membership evidence is the binary: 2.1.270 routes
  // shell PreToolUse hooks through a `classic.PreToolUse` dispatch site.
  on("classic.PreToolUse", {}, async ($, e, next) => next(e));

  // Pins: these lifecycle nouns exist. If upstream adds `session.stop` or
  // similar, this fixture keeps passing; the assertion in CI is what notices.
  on("session.start", {}, async ($, e, next) => next(e));

  // Pins: `engine.create` registers in the middleware spread form, with no
  // matcher. Through 2.1.32x a `{}` matcher validated; from 2.1.330 the
  // validator rejects it as "outside its form" and prescribes exactly this
  // shape. The pass-through spread adds and withholds nothing, which is the
  // smallest registration that still pins the noun.
  on("engine.create", async ($, e, next) => {
    const beneath = await next(e);
    return { ...beneath };
  });

  // Pins the `$` surface names we would migrate onto first. Note the validator
  // reports these without checking they exist, so this is a naming pin, not an
  // existence proof. `$.ui.log` is absent inside engine.create (measured).
  on("prompt.submit", {}, async ($, e, next) => {
    $.ui.log("canary");
    return next(e);
  });
};

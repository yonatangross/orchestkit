# Claude Code output-schema observation for #4333

Observed on 2026-09-26 from the locally installed Claude Code binary. This
record contains only the derived event names, never a binary string dump.

* Claude Code version: `2.1.283`
* Binary path: `~/.local/share/claude/versions/2.1.283`
* SHA256: `d8cb1e5c79684cc12a8bfc813e3a2073406921b6245744b3009be3ab5651d21e`
* Check result: exit `0`

The check command is written without a literal long option delimiter so this
record follows the repository text rule:

```sh
check_dash=-
check_option="${check_dash}${check_dash}check"
CC_OUTPUT_KEYS_BINARY="$HOME/.local/share/claude/versions/2.1.283" \
  node scripts/derive-cc-output-keys.mjs "$check_option"
```

The output classified every current schema-only entry as resolved in the
binary output schema:

```text
Notification: resolved in this binary output-schema variant
PostModelSwitch: resolved in this binary output-schema variant
Setup: resolved in this binary output-schema variant
UserPromptExpansion: resolved in this binary output-schema variant
```

This establishes parser acceptance only. It does not claim runtime delivery to
the model, so these entries remain separate from trace-and-observe exceptions.

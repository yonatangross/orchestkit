#!/usr/bin/env bash
# Sourced library, never run on its own (tests/fixtures is not globbed by the runner).
set -euo pipefail
#
# ONE definition of "this skill description tells the model when to use the skill",
# shared by every skill description check, so the checks cannot drift apart again.
#
# Why it exists (orchestkit row 11, 2026-11-13): #5043 (3036b2708) trimmed every
# model-facing description to 260 bytes or less and gates that per skill in
# tests/performance/test-token-overhead.sh (Test 4b, and Test 14 for "Not for").
# The standard shape is "<what it does>. Use when|for|before|after|to|only when ...
# [Not for ... (use X)]". It does not echo the skill name, and "Use when" is only
# one of several opening words. Four older checks still demanded the pre-#5043
# shape (the skill name inside the description, and only "use when/for/this"),
# so they warned on every skill that follows the standard: 267 grew to 333.
#
# The model sees "name: description" in the skill listing, so the name is part of
# the surface a description is judged on, not something the description repeats.

# Extended regex (match against a lower-cased description) for a trigger phrase.
# shellcheck disable=SC2034
DESCRIPTION_TRIGGER_ERE='(^|[^[:alnum:]_])(use[[:space:]]+(only[[:space:]]+when|when|for|before|after|to|this|if)|triggers[[:space:]]+on|activates[[:space:]]+for)([^[:alnum:]_]|$)'

# description_has_trigger_phrase <description>
# Succeeds when the description carries a trigger phrase. A description with no
# "Use ..." sentence at all (only a routing boundary such as "Not for X") fails.
description_has_trigger_phrase() {
    local d
    d="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    [[ "$d" =~ $DESCRIPTION_TRIGGER_ERE ]]
}

# description_mentions_name <description> <skill name>
# Succeeds when the description contains the skill name, or any dash-separated
# fragment of it that is 4 characters or longer (same rule the old check used).
description_mentions_name() {
    local d n part
    d="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    n="$(printf '%s' "$2" | tr '[:upper:]' '[:lower:]')"
    if [[ "$d" == *"$n"* ]]; then
        return 0
    fi
    # Skill names are [a-z0-9-] only, so splitting on the dashes by word splitting is safe.
    # shellcheck disable=SC2086
    for part in ${n//-/ }; do
        if [[ ${#part} -ge 4 ]] && [[ "$d" == *"$part"* ]]; then
            return 0
        fi
    done
    return 1
}

# description_is_discoverable <description> <skill name>
# A description is discoverable when it names the skill (or a fragment) OR says
# when to use it. Only a description with neither is a real defect.
description_is_discoverable() {
    description_has_trigger_phrase "$1" || description_mentions_name "$1" "$2"
}

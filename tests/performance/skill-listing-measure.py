#!/usr/bin/env python3
"""Measure the always-loaded skill listing with a real YAML parser.

Used by tests/performance/test-token-overhead.sh (Test 4b and 4c).

    skill-listing-measure.py --cap 260 FILE...

Prints one "OVER <bytes> <name>" line per model-facing skill whose
description + when_to_use exceeds the cap, then a final line
"TOTAL <listing bytes> <over count>", where the listing bytes are
name + description + when_to_use of every model-facing skill (a skill with
`disable-model-invocation: true` is not listed, so it costs nothing).

Why a parser and not text matching (orchestkit#5044): a quoted key
("description":), a spaced key (description :), a YAML alias (*d), single
quotes and block scalars are all valid YAML that a line matcher misreads.
Everything here is measured on the parsed value, in UTF-8 bytes, so Hebrew
and emoji count as bytes, not characters.

Exit codes: 0 ok, 2 cannot measure (missing PyYAML, unreadable or invalid
frontmatter). It fails closed: a file it cannot parse is an error, never a
silent zero.
"""

import argparse
import sys

try:
    import yaml
except ImportError:
    sys.stderr.write("skill-listing-measure: PyYAML is required (pip install PyYAML==6.0.3)\n")
    sys.exit(2)

import re


class StrictBoolLoader(yaml.SafeLoader):
    """SafeLoader where only lowercase true/false are booleans.

    PyYAML follows YAML 1.1 and reads on/off/yes/no as booleans; the repo's
    JavaScript frontmatter parser reads them as strings. Using one narrow
    spelling keeps both parsers on the same skill-selection decision. A value
    such as `disable-model-invocation: on` then loads as a string and is
    rejected in main() instead of silently exempting a skill from the gate.
    """


StrictBoolLoader.yaml_implicit_resolvers = {
    first: [(tag, rx) for tag, rx in rules if tag != "tag:yaml.org,2002:bool"]
    for first, rules in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
StrictBoolLoader.add_implicit_resolver(
    "tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$"), list("tf")
)


def frontmatter(path):
    """Return the parsed frontmatter mapping of a SKILL.md."""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    if not lines or lines[0].rstrip() != "---":
        raise ValueError("no opening --- line")
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            data = yaml.load("\n".join(lines[1:i]), Loader=StrictBoolLoader)  # noqa: S506 (safe subclass)
            if not isinstance(data, dict):
                raise ValueError("frontmatter is not a mapping")
            return data
    raise ValueError("no closing --- line")


def text_field(data, key):
    """A scalar string field, or '' when absent. Anything else is an error."""
    value = data.get(key)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError("%s is not a string (got %s)" % (key, type(value).__name__))
    # A block scalar keeps one trailing newline (clip chomping); it is not text.
    return value.rstrip("\n")


def nbytes(text):
    return len(text.encode("utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cap", type=int, required=True)
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()

    total = 0
    over = 0
    for path in args.files:
        try:
            data = frontmatter(path)
            name = text_field(data, "name")
            desc = text_field(data, "description")
            when = text_field(data, "when_to_use")
        except (OSError, ValueError, yaml.YAMLError) as exc:
            sys.stderr.write("skill-listing-measure: %s: %s\n" % (path, exc))
            return 2
        dmi = data.get("disable-model-invocation")
        if dmi is not None and not isinstance(dmi, bool):
            sys.stderr.write(
                "skill-listing-measure: %s: disable-model-invocation must be true or false, got %r\n"
                % (path, dmi)
            )
            return 2
        if dmi is True:
            continue
        size = nbytes(desc) + nbytes(when)
        total += nbytes(name) + size
        if size > args.cap:
            over += 1
            print("OVER %d %s" % (size, name))
    print("TOTAL %d %d" % (total, over))
    return 0


if __name__ == "__main__":
    sys.exit(main())

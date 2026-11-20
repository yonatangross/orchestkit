#!/usr/bin/env python3
"""Print the exit code each scanner layer alone would give for one file:
"<parsed-rc> <lines-rc>" (0 clean, 1 finding, 2 error). Test helper for the
two-layer AND rule in scripts/ci/check-workflow-issue-text.py."""

import importlib.util
import sys

spec = importlib.util.spec_from_file_location("scan", sys.argv[1])
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)


def rc(result):
    findings, errors = result
    return 2 if errors else 1 if findings else 0


print(rc(scan.analyze_parsed(sys.argv[2])), rc(scan.analyze_lines(sys.argv[2])))

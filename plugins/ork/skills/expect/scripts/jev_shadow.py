#!/usr/bin/env python3
"""Jev step judge for /ork:expect. Three modes off ORK_EXPECT_JEV:

  unset / falsey : off, the script exits before python or the network
  shadow         : log-only second opinion (legacy ORK_EXPECT_JEV_SHADOW
                   truthy maps here too)
  1 | act        : the Jev pick becomes the step's chosen action, with a
                   fail-closed fallback to the agent's own pick

Sends ONE Jev request per expect step: a Choice over the bounded set of
legal next actions (element verbs derived from the interactive ARIA
snapshot plus fixed meta moves) and three loopback-verify Nouls
(goal_reached, page_changed_as_expected, blocked). Emits one
JEV_SHADOW|<step>|<json> line for report.sh. In act mode the record also
carries `path` ("jev" or "fallback:<reason>") and `executed_action`, the
action the agent runs. Every failure is a logged record, never a nonzero
exit, and in act mode every failure falls back to the incumbent pick.

Payload hygiene: only ref id, role, and accessible name leave the machine
per element, capped by config, names truncated, and every outbound string
passes the secret redactor. No page text beyond accessible names is sent.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULTS_FILE = SKILL_DIR / "jev-shadow.defaults.yaml"
ENV_FLAG = "ORK_EXPECT_JEV_SHADOW"
ENV_MODE = "ORK_EXPECT_JEV"
ENV_KEY = "ORK_TYPESAFE_API_KEY"
ENV_ENDPOINT = "ORK_EXPECT_JEV_ENDPOINT"
ENV_CONFIG = "ORK_EXPECT_CONFIG"

TRUTHY = {"1", "true", "yes", "on"}

# Verbs a role can legally take in agent-browser terms.
CLICK_ROLES = {
    "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio",
    "tab", "checkbox", "radio", "switch", "option", "treeitem", "listitem",
}
FILL_ROLES = {"textbox", "searchbox", "spinbutton"}
SELECT_ROLES = {"combobox", "listbox"}

META_ACTIONS = {
    "done": "The step goal is already met; take no element action",
    "wait": "The page is still settling; wait before acting",
    "scroll": "The needed element is likely off-screen; scroll to reveal it",
    "press_enter": "Submit or confirm the focused control via the Enter key",
}

# Roles whose form-field decision Jev can take over in act mode: a value
# Choice for fill-capable elements, a final-state Choice for checkboxes.
CHECKBOX_ROLES = {"checkbox", "menuitemcheckbox", "switch"}

PROMPT_ID = "jev-shadow-v4"

# Outbound strings pass every pattern; each match is replaced in place.
SECRET_PATTERNS = [
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=\-]{6,}"),
    re.compile(
        r"(?i)\b(?:token|secret|passwd|password|api[-_]?key|apikey|"
        r"session|cookie|credential|auth)s?\s*[:=]\s*[^\s;,]{4,}"
    ),
    re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{4,}"),
    re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{8,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b[A-Fa-f0-9]{40,}\b"),
]

SNAP_LINE = re.compile(r'^\s*-?\s*([A-Za-z][\w-]*)\s+"([^"]*)"(?:\s+\[ref=(e\d+)\])?')

JSON_ESCAPE = re.compile(r"\\(?:u[0-9a-fA-F]{4}|[\"\\/bfnrt])")


def truthy(value):
    return str(value or "").strip().lower() in TRUTHY


def resolve_mode():
    """off | shadow | act, from ORK_EXPECT_JEV. `shadow` selects log-only;
    `act` (and the truthy words, incl. `1`) executes the Jev pick. Any other
    set value is off. With ORK_EXPECT_JEV unset the legacy
    ORK_EXPECT_JEV_SHADOW flag still selects shadow."""
    raw = (os.environ.get(ENV_MODE) or "").strip().lower()
    if raw in TRUTHY or raw == "act":
        return "act"
    if raw == "shadow":
        return "shadow"
    if raw:
        return "off"
    return "shadow" if truthy(os.environ.get(ENV_FLAG)) else "off"


def unescape_json(text):
    """Decode JSON-style escapes carried verbatim in input (\\uXXXX, \\/,
    \\", \\\\, \b \f \n \r \t). Secret scanning runs on the decoded form so a
    token smuggled as `token\\u003d<value>` is caught the same as `token=<value>`."""
    def repl(m):
        try:
            return json.loads(f'"{m.group(0)}"')
        except ValueError:
            return m.group(0)
    return JSON_ESCAPE.sub(repl, text)


def sanitize(text, max_chars):
    """Decode JSON escapes, redact secret-looking spans, collapse whitespace,
    truncate. Redaction happens on BOTH encodings' behalf: patterns run on
    the decoded string, so raw and JSON-escaped secrets are caught alike."""
    if not isinstance(text, str):
        return ""
    out = unescape_json(text)
    for pattern in SECRET_PATTERNS:
        out = pattern.sub("[redacted]", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out[:max_chars]


def load_yaml(path):
    try:
        import yaml
    except ImportError:
        return None
    try:
        with Path(path).open(encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except OSError:
        return None


def resolve_config(cli_path):
    """jev_shadow section: --config > $ORK_EXPECT_CONFIG > .expect/config.yaml
    > bundled defaults file. Values never come from code constants."""
    for path in (cli_path, os.environ.get(ENV_CONFIG), ".expect/config.yaml"):
        if path:
            cfg = load_yaml(path)
            if cfg is not None and isinstance(cfg.get("jev_shadow"), dict):
                return cfg["jev_shadow"]
    defaults = load_yaml(DEFAULTS_FILE)
    if defaults and isinstance(defaults.get("jev_shadow"), dict):
        return defaults["jev_shadow"]
    return None


def parse_snapshot_text(raw):
    """Pull (ref, role, name) triples out of `snapshot -i` text output."""
    elements = []
    for line in raw.splitlines():
        m = SNAP_LINE.match(line)
        if m and m.group(3):
            elements.append({"ref": m.group(3), "role": m.group(1), "name": m.group(2)})
    return elements


def walk_json(node, out):
    if isinstance(node, dict):
        role = node.get("role")
        name = node.get("name")
        ref = node.get("ref") or node.get("id")
        if isinstance(ref, str) and isinstance(role, str):
            ref = ref.lstrip("@")
            out.append({"ref": ref, "role": role, "name": name if isinstance(name, str) else ""})
        for value in node.values():
            walk_json(value, out)
    elif isinstance(node, list):
        for item in node:
            walk_json(item, out)


def load_elements(path, cap, name_max):
    """Elements from a recorded `agent-browser snapshot -i` file (text or
    --json). Only ref, role, name are kept; anything else never leaves."""
    try:
        with Path(path).open(encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
    except (OSError, TypeError):
        return []
    elements = []
    stripped = raw.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            walk_json(json.loads(raw), elements)
        except (ValueError, RecursionError):
            elements = []
    if not elements:
        elements = parse_snapshot_text(raw)
    return [
        {"ref": e["ref"], "role": e["role"], "name": sanitize(e["name"], name_max)}
        for e in elements[:cap]
    ]


def build_candidates(elements):
    """Bounded action set: legal verbs per interactive element + meta moves."""
    candidates = {}
    for e in elements:
        ref = e["ref"]
        desc = f'{e["role"]} "{e["name"]}"' if e["name"] else e["role"]
        if e["role"] in CLICK_ROLES:
            candidates[f"click:@{ref}"] = desc
        if e["role"] in FILL_ROLES:
            candidates[f"fill:@{ref}"] = desc
        if e["role"] in SELECT_ROLES:
            candidates[f"select:@{ref}"] = desc
    candidates.update(META_ACTIONS)
    return candidates


def doc_candidates(doc, cap=48):
    """Deterministic candidate values for fill fields, extracted from the
    task document only: RHS of 'Label: value' lines, comma parts, numbers.
    Jev selects among these; it never generates free text for a field."""
    cands, seen = [], set()
    for line in doc.splitlines():
        if ":" not in line:
            continue
        rhs = line.split(":", 1)[1].strip()
        for v in [rhs, *rhs.split(",")]:
            v = v.strip()
            if v and v not in seen and len(v) <= 120:
                seen.add(v)
                cands.append(v)
        for num in re.findall(r"\d[\d.]*", rhs):
            if num not in seen:
                seen.add(num)
                cands.append(num)
    return cands[:cap]


def field_questions(elements, cands, field_cap):
    """Per-field decisions for the form path: which document value a
    fillable element should hold, and the final state of each checkbox.
    Checkboxes get two questions: `list::` locates the item's document
    list (keep/do vs drop/skip vs unlisted) and `field::` asks the final
    state; the decision derives from the list answer and the state answer
    cross-checks it."""
    qs = {}
    n = 0
    for e in elements:
        if n >= field_cap:
            break
        ref, role, name = e["ref"], e["role"], e["name"] or "(unlabeled)"
        if role in CHECKBOX_ROLES:
            # Two-step list question (match-then-map): the `list::` answer
            # locates the item's document list and drives the decision; the
            # `field::` state answer only cross-checks it. Disagreement is
            # recorded and forces the field to defer.
            qs[f"list::{ref}"] = {
                "type": "choice",
                "instructions": (
                    f"Find the item '{name}' in `task_doc`. Which list or "
                    "section names this exact item?"),
                "criteria": {
                    "do": "a keep / do / build / add / verified-done list names it",
                    "drop": "a drop / remove / skip / hold / revert / not-do list names it",
                    "none": "the document does not name this item anywhere",
                },
            }
            qs[f"field::{ref}"] = {
                "type": "choice",
                "instructions": (
                    f"Item '{name}': a checked box means the item stays on "
                    "the active list. What should this checkbox end up as?"),
                "criteria": {
                    "check": "the document wants this item active",
                    "uncheck": "the document wants this item inactive",
                    "skip": "the document does not address this item at all; leave the box exactly as it is",
                },
            }
            n += 1
        elif role in FILL_ROLES | SELECT_ROLES:
            crit = {f"c{i}": v for i, v in enumerate(cands)}
            crit["none"] = "the document gives no value for this field"
            qs[f"field::{ref}"] = {
                "type": "choice",
                "instructions": (
                    f"Which `task_doc` value belongs in the field '{name}' "
                    f"({role})?"),
                "criteria": crit,
            }
            n += 1
    return qs


def normalize_model_action(raw, elements, candidates):
    """Map the agent's picked action text onto a candidate key, or None."""
    if not raw:
        return None
    text = raw.strip()
    m = re.match(r"(?i)^(click|fill|select|check|uncheck|press|drag|upload)\s+@?e(\d+)", text)
    if m:
        key = f"{m.group(1).lower()}:@e{m.group(2)}"
        return key if key in candidates else key
    verb = text.split(None, 1)[0].lower() if text else ""
    if verb in META_ACTIONS:
        return verb
    m = re.match(r'(?i)^(click|fill|select)\s+"([^"]+)"', text)
    if m:
        want_verb, want_name = m.group(1).lower(), m.group(2)
        for e in elements:
            if e["name"] == want_name:
                key = f"{want_verb}:@{e['ref']}"
                return key if key in candidates else key
    if re.match(r"(?i)^press\s+enter\b", text):
        return "press_enter"
    if verb in ("press", "navigate"):
        return verb
    return None


def build_request(goal, last_verify, elements, candidates, model,
                  task_doc=None, cands=None, field_cap=0):
    questions = {
            "next_action": {
                "type": "choice",
                "instructions": (
                    "A browser-testing agent must make exactly one move toward `step_goal`. "
                    "Which single legal action is the best next move? Candidates are the "
                    "interactive elements of the current page plus the fixed meta moves."
                ),
                "criteria": candidates,
            },
            "goal_reached": {
                "type": "noul",
                "instructions": "Is `step_goal` already satisfied on the current page, so no further action is needed?",
                "criteria": {
                    "true": "The goal is visibly met by the current page state",
                    "false": "Further interaction is still needed",
                },
            },
            "page_changed_as_expected": {
                "type": "noul",
                "instructions": "Did the page respond to the previous step the way `last_verify` describes?",
                "criteria": {
                    "true": "The observed state matches the expected outcome",
                    "false": "The page did not change as expected, or `last_verify` reports a failure",
                },
            },
            "blocked": {
                "type": "noul",
                "instructions": "Is progress blocked by a modal dialog, a login or signup wall, a captcha, or a permission prompt?",
                "criteria": {
                    "true": "A blocking element stands between the agent and the goal",
                    "false": "Nothing blocks the next action",
                },
            },
    }
    if task_doc and cands and field_cap > 0:
        questions.update(field_questions(elements, cands, field_cap))
    state = {
        "step_goal": goal,
        "last_verify": last_verify,
        "interactive_elements": elements,
    }
    if task_doc:
        state["task_doc"] = task_doc
    return {"state": state, "model": model, "questions": questions}


def post_jev(endpoint, api_key, payload, timeout_s):
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        return json.loads(resp.read().decode("utf-8"))


def emit(step_id, record):
    line = json.dumps(record, separators=(",", ":"), ensure_ascii=True)
    line = re.sub(r"[|\t\n\r]", " ", line)
    print(f"JEV_SHADOW|{step_id or '-'}|{line}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--step-id", default="-")
    parser.add_argument("--goal", default="")
    parser.add_argument("--last-verify", default="")
    parser.add_argument("--model-action", default="")
    parser.add_argument("--snapshot-file", default=None)
    parser.add_argument("--config", default=None)
    parser.add_argument("--task-doc", default=None,
                        help="form task document; enables per-field value/state decisions")
    parser.add_argument("--session-id", default=None,
                        help="browser session id for the decision record")
    parser.add_argument("--prompt-id", default=None,
                        help="override the prompt identifier in the record")
    args = parser.parse_args()

    mode = resolve_mode()
    if mode == "off":
        return 0

    def finish(record, path=None, action=None):
        if mode == "act":
            record["mode"] = "act"
            record["path"] = path
            record["executed_action"] = action
        emit(args.step_id, record)

    cfg = resolve_config(args.config)
    if cfg is None:
        finish({"step_id": args.step_id, "error": "no jev_shadow config", "agree": None},
               "fallback:no_config", args.model_action)
        return 0

    element_cap = int(cfg.get("element_cap", 0) or 0)
    name_max = int(cfg.get("name_max_chars", 0) or 0)
    context_max = int(cfg.get("context_max_chars", 0) or 0)
    budget_ms = int(cfg.get("latency_budget_ms", 0) or 0)
    model = str(cfg.get("model", ""))
    endpoint = os.environ.get(ENV_ENDPOINT) or str(cfg.get("endpoint", ""))
    thresholds = cfg.get("thresholds") or {}
    conf_floor = cfg.get("act_confidence_floor")
    list_floor = cfg.get("act_list_confidence_floor")
    field_cap = int(cfg.get("field_cap", 0) or 0)
    doc_max = int(cfg.get("doc_max_chars", 0) or 0)
    prompt_id = args.prompt_id or str(cfg.get("prompt_id", "")) or PROMPT_ID
    session_id = args.session_id or os.environ.get("ORK_EXPECT_SESSION") or os.environ.get("AB_SESSION")

    if element_cap <= 0 or name_max <= 0 or context_max <= 0 or budget_ms <= 0 or not model or not endpoint:
        finish({"step_id": args.step_id, "error": "incomplete jev_shadow config", "agree": None},
               "fallback:incomplete_config", args.model_action)
        return 0

    goal = sanitize(args.goal, context_max)
    last_verify = sanitize(args.last_verify, context_max)
    task_doc = sanitize(args.task_doc, doc_max) if args.task_doc and doc_max > 0 else None
    elements = load_elements(args.snapshot_file, element_cap, name_max)
    candidates = build_candidates(elements)
    cands = doc_candidates(task_doc) if task_doc else None
    model_key = normalize_model_action(args.model_action, elements, candidates)
    incumbent = model_key or args.model_action

    base = {
        "step_id": args.step_id,
        "model_action": args.model_action,
        "model_action_key": model_key,
        "model": model,
        "latency_budget_ms": budget_ms,
        "prompt_id": prompt_id,
        "session_id": session_id,
        "floor": conf_floor,
        "incumbent_pick": incumbent,
    }

    api_key = (os.environ.get(ENV_KEY) or "").strip()
    if not api_key:
        finish({**base, "error": "no_api_key", "agree": None},
               "fallback:no_api_key", incumbent)
        return 0

    started = time.monotonic()
    try:
        body = post_jev(endpoint, api_key, build_request(goal, last_verify, elements, candidates, model,
                                                       task_doc=task_doc, cands=cands, field_cap=field_cap), budget_ms / 1000.0)
    except urllib.error.HTTPError as exc:
        finish({**base, "error": f"http {exc.code}", "agree": None, "latency_ms": int((time.monotonic() - started) * 1000)},
               f"fallback:http_{exc.code}", incumbent)
        return 0
    except (urllib.error.URLError, TimeoutError):
        finish({**base, "error": "unreachable_or_timeout", "agree": None, "latency_ms": int((time.monotonic() - started) * 1000)},
               "fallback:unreachable_or_timeout", incumbent)
        return 0
    except (ValueError, OSError):
        finish({**base, "error": "request_failed", "agree": None, "latency_ms": int((time.monotonic() - started) * 1000)},
               "fallback:request_failed", incumbent)
        return 0
    latency_ms = int((time.monotonic() - started) * 1000)

    answers = body.get("answers") if isinstance(body, dict) else None
    choice_answer = (answers or {}).get("next_action") or {}
    jev_action = choice_answer.get("choice")
    if jev_action not in candidates:
        reason = "empty_answer" if mode == "act" and not answers else "malformed_answer"
        finish({**base, "error": reason, "agree": None, "latency_ms": latency_ms},
               "fallback:" + reason, incumbent)
        return 0

    nouls = {}
    for qid in ("goal_reached", "page_changed_as_expected", "blocked"):
        val = ((answers or {}).get(qid) or {}).get("noul")
        nouls[qid] = val if isinstance(val, (int, float)) else None

    flags = {"low_confidence": None}
    conf = choice_answer.get("confidence")
    low_thr = thresholds.get("low_confidence")
    if isinstance(conf, (int, float)) and isinstance(low_thr, (int, float)):
        flags["low_confidence"] = conf < low_thr
    for qid in nouls:
        thr = thresholds.get(qid)
        flags[qid] = (nouls[qid] >= thr) if isinstance(nouls[qid], (int, float)) and isinstance(thr, (int, float)) else None

    below_floor = (
        isinstance(conf, (int, float))
        and isinstance(conf_floor, (int, float))
        and conf < conf_floor
    )
    take_jev = mode == "act" and not below_floor

    # Per-field form decisions: a field is decided by Jev only when its own
    # confidence clears the floor; below it the incumbent (the agent's
    # own pick for that field) stands. Fill values resolve through the
    # candidate list; checkbox decisions derive from the list-membership
    # answer (match-then-map), cross-checked against the state answer, and
    # list fields gate on the raised act_list_confidence_floor.
    list_answers = {}
    for qid, ans in (answers or {}).items():
        if qid.startswith("list::"):
            list_answers[qid.split("::", 1)[1]] = ans

    field_decisions = {}
    executed_action = jev_action if take_jev else incumbent
    for qid, ans in (answers or {}).items():
        if not qid.startswith("field::"):
            continue
        ref = qid.split("::", 1)[1]
        el = next((e for e in elements if e["ref"] == ref), None)
        fconf = ans.get("confidence")
        fchoice = ans.get("choice")
        is_list_field = bool(el and el["role"] in CHECKBOX_ROLES)
        eff_floor = list_floor if is_list_field else conf_floor
        if not isinstance(eff_floor, (int, float)):
            eff_floor = conf_floor
        fdec = {"jev_pick": fchoice,
                "jev_confidence": fconf if isinstance(fconf, (int, float)) else None,
                "floor": eff_floor,
                "decided_by": "incumbent"}
        if is_list_field:
            la = list_answers.get(ref) or {}
            lch = la.get("choice")
            lconf = la.get("confidence")
            derived = {"do": "check", "drop": "uncheck", "none": "skip"}.get(lch)
            fdec["list_pick"] = lch
            fdec["list_conf"] = lconf if isinstance(lconf, (int, float)) else None
            if derived is not None:
                if derived != (fchoice if fchoice in ("check", "uncheck", "skip") else "skip"):
                    fdec["inconsistent"] = True
                    fdec["jev_confidence"] = 0.0
                else:
                    confs = [c for c in (lconf, fconf) if isinstance(c, (int, float))]
                    fdec["jev_confidence"] = min(confs) if confs else None
        eff_conf = fdec["jev_confidence"]
        if (isinstance(eff_conf, (int, float)) and isinstance(eff_floor, (int, float))
                and eff_conf >= eff_floor):
            fdec["decided_by"] = "jev"
            if el and el["role"] in FILL_ROLES | SELECT_ROLES:
                if fchoice and fchoice != "none" and fchoice.startswith("c"):
                    i = int(fchoice[1:])
                    if cands and i < len(cands):
                        fdec["value"] = cands[i]
            elif is_list_field:
                if derived is not None:
                    fdec["target"] = derived
                else:
                    fdec["target"] = fchoice if fchoice in ("check", "uncheck", "skip") else "skip"
        field_decisions[ref] = fdec
        # If this field is the step's executed target, carry Jev's decision
        # into the action the agent runs.
        if take_jev and fdec["decided_by"] == "jev":
            if jev_action == f"fill:@{ref}" and fdec.get("value") is not None:
                executed_action = f'fill:@{ref}={json.dumps(fdec["value"], ensure_ascii=False)}'
            elif jev_action == f"click:@{ref}" and fdec.get("target") in ("check", "uncheck"):
                executed_action = f'{fdec["target"]}:@{ref}'
            elif jev_action == f"click:@{ref}" and fdec.get("target") == "skip":
                executed_action = "done"

    finish({
        **base,
        "jev_action": jev_action,
        "jev_pick": jev_action,
        "jev_action_probability": (choice_answer.get("probabilities") or {}).get(jev_action),
        "jev_confidence": conf if isinstance(conf, (int, float)) else None,
        "decided_by": "jev" if take_jev else "incumbent",
        "field_decisions": field_decisions or None,
        "probabilities": choice_answer.get("probabilities") or {},
        "nouls": nouls,
        "flags": flags,
        "agree": (model_key == jev_action) if model_key else False,
        "latency_ms": latency_ms,
        "error": None,
    }, "jev" if take_jev else "fallback:low_confidence",
       executed_action)
    return 0


if __name__ == "__main__":
    sys.exit(main())

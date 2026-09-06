# Probe: does CC 2.1.263 honour skill behaviour keys under `metadata.*`?

Status: **measured 2026-09-06**, one workstation, Claude Code 2.1.263, model
`sonnet` for every run. Part of the #2528 close-out. No frontmatter in
`src/skills/` was changed by this probe; it decides whether a later
spec-clean sweep is possible at all.

## Question

The Agent Skills spec allows six frontmatter fields (`name`, `description`,
`license`, `compatibility`, `metadata`, `allowed-tools`) and says runtime
specific keys belong under `metadata:`. OrchestKit skills carry about twenty
top-level keys, three of which change Claude Code's behaviour:
`argument-hint`, `disable-model-invocation` and `user-invocable`. If Claude
Code read those three from `metadata.*`, the sweep could move them there and
stay spec-clean without losing behaviour. If it ignores them there, the sweep
cannot move them.

## Verdict

| key | top-level form | `metadata.*` form | surface that showed it |
|---|---|---|---|
| `argument-hint` | honoured: `<hint-c96632da>` rendered as ghost text after Tab-completing `/probemd:top-arg` | **ignored**: nothing rendered for `/probemd:md-arg` | interactive `/` menu through a pty (not visible headless: the system prompt listing carries no hint for either form) |
| `disable-model-invocation` | honoured: `probemd:top-dmi` absent from the model's skill list, Skill tool call answered `UNAVAILABLE`; `/top-dmi` still expands for the user | **ignored**: `probemd:md-dmi` listed, Skill tool returned `TOKEN-mddmi-19b12cde` | headless `claude -p` |
| `user-invocable` | honoured: `/top-ui` produced an empty result with `num_turns` 0 and the menu omits it | **ignored**: `/md-ui` expanded to `TOKEN-mdui-35345e73` and the menu lists it | headless `claude -p` plus the pty menu |

All three behaviour keys are read from the top level only. A frontmatter
sweep that moves them under `metadata.*` on CC 2.1.263 would silently drop
the behaviour, counted in `src/skills` at HEAD: 39 skills would lose their
argument hint, 29 with `disable-model-invocation: true` would become
model-invocable, and 71 with `user-invocable: false` would show up in the
`/` menu. **Not possible today.** Re-run this probe on each CC release that
touches skill loading before revisiting.

## Fixture

Throwaway plugin at `$TMPDIR/probe-2528/plugin`, never installed, loaded with
`--plugin-dir`. Seven skills: one baseline, three top-level controls, three
`metadata.*` variants. Each body asks for one nonce token so the output is a
string match, not a judgement. Nonces from `openssl rand -hex 4`:
`NA=c96632da` (argument-hint), `ND=19b12cde` (disable-model-invocation),
`NU=35345e73` (user-invocable, also used by the baseline).

```
plugin/.claude-plugin/plugin.json
  {"name":"probemd","version":"0.0.1","description":"throwaway probe: do CC skills honour behaviour keys under metadata.*"}
plugin/skills/base/SKILL.md          no behaviour key
plugin/skills/top-arg/SKILL.md       argument-hint: "<hint-NA>"
plugin/skills/md-arg/SKILL.md        metadata: { argument-hint: "<hint-NA>" }
plugin/skills/top-dmi/SKILL.md       disable-model-invocation: true
plugin/skills/md-dmi/SKILL.md        metadata: { disable-model-invocation: "true" }
plugin/skills/top-ui/SKILL.md        user-invocable: false
plugin/skills/md-ui/SKILL.md         metadata: { user-invocable: "false" }
```

The two `metadata.*` files exactly as written:

```yaml
---
name: md-arg
description: probe skill md-arg, replies with a token
metadata:
  argument-hint: "<hint-c96632da>"
---
Reply with exactly this token and nothing else: TOKEN-mdarg-c96632da
```

```yaml
---
name: md-dmi
description: probe skill md-dmi, replies with a token
metadata:
  disable-model-invocation: "true"
---
Reply with exactly this token and nothing else: TOKEN-mddmi-19b12cde
```

```yaml
---
name: md-ui
description: probe skill md-ui, replies with a token
metadata:
  user-invocable: "false"
---
Reply with exactly this token and nothing else: TOKEN-mdui-35345e73
```

`claude plugin validate plugin` passed with one warning (no author).

## Headless commands and results

Every headless run used this shape, from `$TMPDIR` so no project settings
apply, with `--setting-sources ""` so no user hooks could rewrite the answer
(a Stop hook correction turn has replaced `claude -p` output before). `--bare`
was tried first and rejected: it accepts only `ANTHROPIC_API_KEY` auth and
answered `Not logged in`.

```bash
cd "$TMPDIR"
claude -p --setting-sources "" --plugin-dir "$TMPDIR/probe-2528/plugin" \
  --model sonnet --output-format json --no-session-persistence \
  --max-turns 4 --permission-mode dontAsk "<prompt>" < /dev/null
```

| label | prompt | `.result` | `num_turns` |
|---|---|---|---|
| smoke-slash | `/base` | `TOKEN-base-35345e73` | 1 |
| smoke-slash-ns | `/probemd:base` | `TOKEN-base-35345e73` | 1 |
| smoke-skill | Use the Skill tool to invoke `base` and reply with only the token | `TOKEN-base-35345e73` | 3 |
| smoke-list | List every available skill named base or starting md- or top- | `probemd:base probemd:md-arg probemd:md-dmi probemd:md-ui probemd:top-arg probemd:top-ui` | 1 |
| list-2 | same prompt, second run | `base md-arg md-dmi md-ui top-arg top-ui` | 1 |
| dmi-top-skill | Skill tool on `probemd:top-dmi`, reply token or `UNAVAILABLE` | `UNAVAILABLE` | 2 |
| dmi-md-skill | Skill tool on `probemd:md-dmi`, reply token or `UNAVAILABLE` | `TOKEN-mddmi-19b12cde` | 3 |
| dmi-top-slash | `/top-dmi` | `TOKEN-topdmi-19b12cde` | 1 |
| dmi-md-slash | `/md-dmi` | `TOKEN-mddmi-19b12cde` | 1 |
| ui-top-slash | `/top-ui` | `(empty)` | 0 |
| ui-top-slash-ns | `/probemd:top-ui` | `(empty)` | 0 |
| ui-md-slash | `/md-ui` | `TOKEN-mdui-35345e73` | 1 |
| ui-md-slash-ns | `/probemd:md-ui` | `TOKEN-mdui-35345e73` | 1 |
| arg-top-quote | Quote the system prompt line for `probemd:top-arg` | `- probemd:top-arg: probe skill top-arg, replies with a token` | 1 |
| arg-md-quote | Quote the system prompt line for `probemd:md-arg` | `- probemd:md-arg: probe skill md-arg, replies with a token` | 1 |
| arg-any | Does `hint-c96632da` appear anywhere in your system prompt or tool descriptions | `NO` | 1 |

Reading the table:

- `top-dmi` is missing from both skill listings while `md-dmi` is present, and
  the Skill tool reaches `md-dmi` but not `top-dmi`. Both slash forms expand,
  which is the documented behaviour of `disable-model-invocation` (user can,
  model cannot).
- `/top-ui` ends with zero model turns and an empty result: Claude Code
  recognised the skill and refused the user invocation. `/md-ui` ran one turn
  and echoed the token.
- Neither form of the hint reaches the system prompt, so headless cannot
  decide `argument-hint`. The pty run below does.

## Interactive commands and results (argument-hint, and the `/` menu)

The `/` autocomplete is the only surface that renders `argument-hint`. It was
driven through a pseudo-terminal from `$TMPDIR` with the same plugin. Under
the Claude Code sandbox `pty.fork()` fails with `out of pty devices` (the
`/dev` allowlist has no `/dev/ptmx`), so this one step ran with the sandbox
off. `--no-session-persistence` is print-mode only and must be dropped. The
first Enter on the trust dialog selects "No, exit"; Down then Enter is needed.

```python
import os, pty, sys, time, select, fcntl, termios, struct, re, json, signal
P = os.environ['P']; NA = os.environ['NA']
OUT = f'{P}/out/pty2'; os.makedirs(OUT, exist_ok=True)
cmd = ['claude', '--setting-sources', '', '--plugin-dir', f'{P}/plugin', '--model', 'sonnet']
env = dict(os.environ); env.pop('CLAUDECODE', None); env['TERM'] = 'xterm-256color'
pid, fd = pty.fork()
if pid == 0:
    os.chdir(os.environ['TMPDIR']); os.execvpe(cmd[0], cmd, env)
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 160, 0, 0))
ANSI = re.compile(rb'\x1b\][^\x07]*\x07|\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Za-z0-9]|\x1b[=>]|\r')
def read_for(secs):
    out = b''; end = time.time() + secs
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            try: d = os.read(fd, 65536)
            except OSError: break
            if not d: break
            out += d
    return out
def clean(b): return ANSI.sub(b'', b).decode('utf-8', 'replace')
def send(s): os.write(fd, s.encode())
txt = clean(read_for(15))
if re.search(r'trust', txt, re.I):
    send('\x1b[B'); time.sleep(0.5); send('\r'); txt += clean(read_for(10))
open(f'{OUT}/boot.txt', 'w').write(txt)
results = {}
short = NA[:5]
for name in ['top-arg', 'md-arg']:
    caps = {}
    q = f'/probemd:{name}'
    for ch in q: send(ch); time.sleep(0.06)
    raw = read_for(3); caps['typed'] = raw
    send('\t'); raw = read_for(2); caps['tab'] = raw
    send(' '); raw = read_for(3); caps['space'] = raw
    r = {}
    for k, raw in caps.items():
        c = clean(raw)
        open(f'{OUT}/{name}-{k}.txt', 'w').write(c); open(f'{OUT}/{name}-{k}.raw', 'wb').write(raw)
        r[k] = {'nonce_full': f'hint-{NA}' in c, 'nonce_frag': short in c,
                'excerpt': ' | '.join(l.strip() for l in c.splitlines() if 'hint' in l or 'arg' in l)[:300]}
    results[name] = r
    send('\x15'); time.sleep(0.3)
    for _ in range(len(q) + 2): send('\x7f'); time.sleep(0.02)
    read_for(1.5)
send('\x03'); time.sleep(0.4); send('\x03'); read_for(2)
try: os.kill(pid, signal.SIGTERM)
except ProcessLookupError: pass
json.dump(results, open(f'{OUT}/results.json', 'w'), indent=2)
for name, r in results.items():
    for k, v in r.items(): print(name, k, 'full=%s frag=%s' % (v['nonce_full'], v['nonce_frag']), '::', v['excerpt'][:220])
```

Run as `P=$TMPDIR/probe-2528 NA=<nonce> python3 probe-pty2.py`. Captures are
saved raw and ANSI-stripped under `out/pty2/`. Results:

| skill | after typing `/probemd:<name>` | after Tab | after Tab and a space |
|---|---|---|---|
| top-arg | menu row, no hint | **`<hint-c96632da>` rendered** (nonce_full=True) | (menu closed) |
| md-arg | menu row, no hint | nothing (nonce_full=False, fragment=False) | nothing |

A first pty pass typed partial names and recorded which rows the menu offered
(`out/pty/results.json`):

| typed | rows offered |
|---|---|
| `/top-u` | top-arg, top-dmi (top-ui absent) |
| `/md-u` | md-ui, md-arg, md-dmi |
| `/top-d` | top-dmi, top-arg |
| `/md-d` | md-dmi, md-arg, md-ui |

So `user-invocable: false` at the top level removes the row from the menu and
`metadata.user-invocable` does not, matching the headless result.

## What this does not cover

- One model (`sonnet`), one CC build (2.1.263), one workstation. The
  string-match design makes model variance unlikely to matter, and the listing
  prompt was run twice with identical output, but nothing here was repeated
  across versions.
- Only the three behaviour keys. `tags`, `complexity`, `version` and the other
  informational keys were not probed; nothing in Claude Code is known to read
  them, so moving those under `metadata.*` is a separate, lower-risk question.
- Whether other clients (pi, the Skills API, claude.ai uploads) read
  `metadata.*` behaviour keys. pi honours top-level
  `disable-model-invocation` (measured 2026-08-30) and was not re-run here.

## Related

- `docs/audits/design-2528-skill-mirror-single-source.md` (the decision this
  probe closes out)
- #3822 (same-skill references went bare-relative; the earlier probe of this
  shape, CC 2.1.251)

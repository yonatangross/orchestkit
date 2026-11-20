# Pulling Traces from Langfuse

The skill needs ~100 real traces in a normalized JSONL shape. Two sources: the
Langfuse public API (live) or an exported JSONL file (offline).

## Credentials and safety

Auth is HTTP Basic with the project public key as username and secret key as
password. Both come from env vars:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST` (for example `https://cloud.langfuse.com` or a self-hosted URL)

Never print, log, or paste the secret value. Use `-u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY"`
so the credential stays inside the variable. If the env vars are unset, stop and ask
the user to provide them or to hand over a JSONL export instead.

Basic auth sends the secret in every request header, so transport matters. The
guard below matches the Phase 1 pull in `../SKILL.md`: `--proto '=https'` fails
closed on non-HTTPS schemes, and relaxes to `'=http,https'` only for an exact
local endpoint (lowercased `http://localhost`, `http://127.0.0.1`, or
`http://[::1]`, optional port and path, no userinfo). Anything else needs HTTPS
or an SSH tunnel to localhost.

```bash
proto="=https"
host_lc=$(printf '%s' "$LANGFUSE_HOST" | tr 'A-Z' 'a-z')
case "$host_lc" in
  http://*)
    authority=${host_lc#http://}
    authority=${authority%%/*}
    case "$authority" in
      *@*) printf '%s\n' 'Refusing HTTP with userinfo in the URL; use HTTPS.' >&2; exit 1 ;;
    esac
    case "$authority" in
      localhost|localhost:*|127.0.0.1|127.0.0.1:*|\[::1\]|\[::1\]:*) proto="=http,https" ;;
      *) printf '%s\n' 'Refusing plain HTTP to a non-local host; use HTTPS or an SSH tunnel to localhost.' >&2; exit 1 ;;
    esac
    ;;
esac
```

## Public API shape

Langfuse v4 removed the legacy trace reads (`GET /api/public/traces` and
`/api/public/traces/{id}` return 404 on v4 and are deprecated on v3). The
supported read is the Observations API v2:

```
GET {LANGFUSE_HOST}/api/public/v2/observations?fromStartTime=...&toStartTime=...&limit=100&fields=core,basic,trace_context,io
GET {LANGFUSE_HOST}/api/public/v2/observations?traceId=<id>&fields=core,basic,io
```

The response is observation rows, not trace objects. Group rows by `traceId` to
reconstruct each trace. The root is the row with `isRootObservation: true`;
Langfuse can set that flag even when `parentObservationId` is non-null. When no
row is flagged, fall back to a `parentObservationId == null` row only if exactly
one exists. Zero or several null-parent rows means the root is ambiguous: mark
that trace `root-unknown` in the notes and exclude it from the pool rather than
guessing, because picking a row could assign another observation's input and
output to the trace. The root stands in for trace-level `input`/`output`. Pagination is a `cursor` in the
response metadata, results come back sorted by `startTime` descending, and
`limit` caps at 1000. Always pass `fromStartTime`/`toStartTime` to keep each
request bounded. Include `io` in `fields` on every call; without it the rows come
back without `input`/`output`, which are exactly what the prompt-or-code replay
step needs.

Observation rows carry no scores. Failure prioritization needs them, so fetch
scores per selected trace id from the Scores API v3 and join by `traceId`:

```
GET {LANGFUSE_HOST}/api/public/v3/scores?traceId=<id>
```

Example pull loop (v2, short flags only). Stop on trace count, not page count:
one page is up to 1000 observation rows, but a single trace can own many rows.
Check the HTTP status every page so a 429 or 5xx error body is not mistaken for
an exhausted cursor, and clear stale pages before starting.

```bash
mkdir -p error-analysis/traces
rm -f error-analysis/traces/page*.json   # drop stale pages from earlier runs
cursor=""
page=1
while true; do
  url="$LANGFUSE_HOST/api/public/v2/observations?fromStartTime=$FROM&toStartTime=$TO&limit=1000&fields=core,basic,trace_context,io"
  [ -n "$cursor" ] && url="$url&cursor=$cursor"
  out="error-analysis/traces/page$page.json"
  code=$(curl -sS -w '%{http_code}' --proto "${proto:-=https}" -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" "$url" -o "$out")
  case "$code" in
    2*) ;;
    *) printf 'Observations API returned %s; aborting pull\n' "$code" >&2; exit 1 ;;
  esac
  traces=$(jq -sr '[.[].data[].traceId] | unique | length' error-analysis/traces/page*.json)
  [ "$traces" -ge 100 ] && break
  cursor=$(jq -r '.meta.cursor // empty' "$out")
  [ -z "$cursor" ] && break
  page=$((page + 1))
done
```

Reaching 100 distinct trace ids mid-page can still cut a trace in half: its rows
are contiguous only while paging, so the last trace in the pool may be missing
observations (including its root). Finish the selected traces before moving on.
Either keep paging until every selected `traceId` has a root row, or fetch the
missing observations per trace:

```
GET {LANGFUSE_HOST}/api/public/v2/observations?traceId=<id>&fields=core,basic,io
```

On a Langfuse v3 host the deprecated `GET /api/public/traces?limit=100&page=1`
list still answers (params `page`, `userId`, `sessionId`, `tags`,
`fromTimestamp`, `toTimestamp`; observations on the detail endpoint). Prefer v2;
the migration mapping lives in the Langfuse deprecated-API migration doc.

Then normalize with jq or a small script into `error-analysis/traces.jsonl`, one line
per trace:

```json
{"id": "tr_...", "timestamp": "...", "input": ..., "output": ..., "scores": {...}, "observations": [{"type": "tool", "name": "...", "input": ..., "output": ...}]}
```

Field names differ across Langfuse versions; inspect one real trace object before
writing the normalization (`jq '.data[0] | keys' error-analysis/traces/page1.json`).

## Picking which traces to review

The pool should over-represent failures. Signals to prefer, in rough order:

1. Negative user feedback or low human/agent scores on the trace
2. Exceptions, error observations, retries, escalations to a human
3. Long traces that ended without a usable answer
4. A random slice of the remainder for coverage (some failures are silent)

If the `scores` field exists, filter or sort by it. If nothing looks like a failure in
the first 30, tell the user before burning the whole pool on happy-path traces.

## Exported JSONL fallback

Teams often export traces by hand (Langfuse UI export, a warehouse query, a logging
pipeline). Accept any JSONL where each line is one interaction with at minimum an id,
an input, and an output. Map foreign field names to the normalized shape and record
the mapping in `traces.jsonl` provenance comment at the top of the notes file.

If lines lack tool observations, say so: the prompt-or-code replay step degrades to
inspecting whatever tool outputs were logged, or is skipped per trace with the skip
noted.

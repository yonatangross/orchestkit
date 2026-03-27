# rrweb Session Recording (#1178)

Full session replay without video encoding — captures DOM mutations and events as lightweight JSON.

## Why rrweb Over Video

| Approach | Size | Quality | Interaction |
|----------|------|---------|-------------|
| Video (mp4) | ~5MB/min | Lossy | Watch only |
| rrweb JSON | ~100KB/min | Lossless DOM | Replay, inspect, debug |

## Integration Points

### Injection via agent-browser eval
```javascript
// Inject rrweb recorder at test start
eval(`
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.4/dist/rrweb-all.min.js';
  script.onload = () => {
    window.__rrweb_events = [];
    rrweb.record({ emit: (e) => window.__rrweb_events.push(e) });
  };
  document.head.appendChild(script);
`);
```

### Collect events at test end
```javascript
// Extract recorded events
const events = eval("JSON.stringify(window.__rrweb_events)");
```

### Storage
```
.expect/recordings/
├── 2026-03-26T16-30-00-login.json    # rrweb events
└── 2026-03-26T16-30-00-dashboard.json
```

## Replay

rrweb recordings can be replayed in any browser:

```html
<script src="https://cdn.jsdelivr.net/npm/rrweb-player@2.0.0-alpha.4/dist/index.js"></script>
<div id="player"></div>
<script>
  fetch('.expect/recordings/login.json')
    .then(r => r.json())
    .then(events => new rrwebPlayer({ target: document.getElementById('player'), events }));
</script>
```

## Config

```yaml
# .expect/config.yaml
rrweb:
  enabled: false          # Opt-in (adds ~100KB overhead per page)
  storage: .expect/recordings/
  keep_last: 5            # Retain last 5 recordings
  record_on: fail         # always | fail | never
```

## Notes

- rrweb is injected via `eval` — works with any framework, no build step needed
- Recordings are gitignored (ephemeral, large-ish)
- Only record on failure by default to minimize storage
- Future: integrate with report.md to embed replay links in failure details

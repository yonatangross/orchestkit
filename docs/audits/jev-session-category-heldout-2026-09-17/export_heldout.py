"""Export the held-out set: the most recent sessions that have a stored haiku category
and a readable first prompt, excluding every session in --exclude (the rows used while
writing the criteria). Output rows carry private prompt text: keep them out of git."""
import argparse, json, os, glob, re, sys
ap = argparse.ArgumentParser()
ap.add_argument('--exclude', required=True, help='jsonl whose "session" fields must not be reused')
ap.add_argument('--limit', type=int, default=150)
ap.add_argument('--out', default='heldout-150.jsonl')
args = ap.parse_args()
base = os.path.expanduser('~/.claude/plugins/data')
cats = ['bugfix','feature','docs','refactor','infra','perf','design','testing']
raws = glob.glob(base + '/*/sessions/*/session-identity.raw')
raws.sort(key=os.path.getmtime, reverse=True)
tx_index = {}
for p in glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
    tx_index[os.path.basename(p)[:-6]] = p
seen_ids = {json.loads(l)['session'] for l in open(args.exclude)}
rows = []
seen = set()
for r in raws:
    sid = os.path.basename(os.path.dirname(r))
    if sid in seen or sid in seen_ids: continue
    try: raw = open(r).read()
    except Exception: continue
    m = re.search(r'\{.*\}', raw, re.S)
    if not m: continue
    try: obj = json.loads(m.group(0))
    except Exception: continue
    cat = str(obj.get('category','')).lower().strip()
    if cat not in cats: continue
    tx = tx_index.get(sid)
    if not tx: continue
    prompt, branch = None, ''
    try:
        with open(tx) as f:
            for line in f:
                try: rec = json.loads(line)
                except Exception: continue
                if rec.get('type') != 'user' or rec.get('isSidechain') or rec.get('isMeta'): continue
                c = rec.get('message',{}).get('content')
                if isinstance(c, list):
                    texts = [x.get('text','') for x in c if isinstance(x,dict) and x.get('type')=='text']
                    c = '\n'.join(texts) if texts else None
                if not isinstance(c,str) or not c.strip(): continue
                if c.lstrip().startswith(('<local-command','<command-name','<command-message','Caveat:')): continue
                prompt = c; branch = rec.get('gitBranch','') or ''
                break
    except Exception: continue
    if not prompt: continue
    seen.add(sid)
    rows.append({'id': len(rows)+1, 'session': sid, 'branch': branch, 'prompt': re.sub(r'\s+',' ',prompt).strip()[:600], 'haiku': cat, 'haiku_title': obj.get('title','')})
    if len(rows) >= args.limit: break
out = args.out
with open(out,'w') as f:
    for x in rows: f.write(json.dumps(x)+'\n')
from collections import Counter
print(len(rows), dict(Counter(x['haiku'] for x in rows)), 'raws', len(raws))

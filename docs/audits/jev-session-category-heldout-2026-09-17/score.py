"""Held-out scoring: jev-B (candidate) vs haiku-B (control, same criteria) vs haiku-today (stored, short prompt).
Writes results.json and prints a report. Labels only; no prompt text."""
import json, math, os
from collections import Counter
D = os.path.dirname(os.path.abspath(__file__))
def L(f): return {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, f))}
rows, hand, jev, hk = L('heldout-150.jsonl'), L('heldout-150-hand.jsonl'), L('heldout-150-jev-B.jsonl'), L('heldout-150-haiku-B.jsonl')
ids = sorted(rows); sure = [i for i in ids if not hand[i]['unsure']]
P = {'haiku_today': {i: rows[i]['haiku'] for i in ids}, 'haiku_B': {i: hk[i]['category'] for i in ids}, 'jev_B': {i: jev[i]['category'] for i in ids}}
collapse = lambda c: 'testing' if c == 'review' else c
def acc(pred, sub, col=False):
    k = sum((collapse(pred[i]) if col else pred[i]) == (collapse(hand[i]['hand']) if col else hand[i]['hand']) for i in sub)
    return {'correct': k, 'n': len(sub), 'pct': round(100 * k / len(sub), 1)}
def mcnemar(a, b):
    ra = sum(a[i] == hand[i]['hand'] and b[i] != hand[i]['hand'] for i in ids)
    rb = sum(b[i] == hand[i]['hand'] and a[i] != hand[i]['hand'] for i in ids)
    n, k = ra + rb, min(ra, rb)
    p = 1.0 if n == 0 else min(1.0, 2 * sum(math.comb(n, x) for x in range(k + 1)) / 2 ** n)
    return {'a_only_right': ra, 'b_only_right': rb, 'p': round(p, 4)}
def pct(vals, q):
    v = sorted(x for x in vals if x is not None); return v[min(len(v) - 1, math.ceil(q * len(v)) - 1)] if v else None
R = {'rows': {'heldout': len(ids), 'sure': len(sure), 'unsure': len(ids) - len(sure), 'overlap_with_tuning_80': 0,
              'errors': {'jev_B': sum(bool(jev[i].get('error')) for i in ids), 'haiku_B': sum(bool(hk[i].get('error')) for i in ids)}},
     'hand_dist': dict(Counter(hand[i]['hand'] for i in ids))}
R['accuracy'] = {k: {'all_9cat': acc(p, ids), 'sure_9cat': acc(p, sure), 'all_8cat_review_as_testing': acc(p, ids, True)} for k, p in P.items()}
R['mcnemar'] = {'jev_B_vs_haiku_B': mcnemar(P['jev_B'], P['haiku_B']), 'jev_B_vs_haiku_today': mcnemar(P['jev_B'], P['haiku_today'])}
R['kill_criterion'] = {'gap_points_jev_minus_haiku_B': round(R['accuracy']['jev_B']['all_9cat']['pct'] - R['accuracy']['haiku_B']['all_9cat']['pct'], 1),
                       'jev_p95_ms': pct([jev[i]['latency_ms'] for i in ids], .95)}
R['kill_criterion']['killed'] = R['kill_criterion']['gap_points_jev_minus_haiku_B'] < -5 or R['kill_criterion']['jev_p95_ms'] > 1000
buckets = []
for lo, hi in [(0, .5), (.5, .8), (.8, 1.01)]:
    b = [i for i in ids if lo <= (jev[i].get('confidence') or 0) < hi]
    buckets.append({'range': f'[{lo},{min(hi,1)}]', 'n': len(b), 'correct': sum(P['jev_B'][i] == hand[i]['hand'] for i in b)})
R['jev_confidence_buckets'] = buckets
R['latency_ms'] = {k: {'p50': pct([s[i]['latency_ms'] for i in ids], .5), 'p95': pct([s[i]['latency_ms'] for i in ids], .95)} for k, s in (('jev_B', jev), ('haiku_B', hk))}
R['input_tokens_mean'] = {k: round(sum(s[i].get('input_tokens') or 0 for i in ids) / len(ids)) for k, s in (('jev_B', jev), ('haiku_B', hk))}
R['haiku_B_list_cost_usd'] = round(sum(hk[i].get('cost_usd') or 0 for i in ids), 4)
R['review_option'] = {'hand_rows': sum(hand[i]['hand'] == 'review' for i in ids),
    'jev_picks': sum(P['jev_B'][i] == 'review' for i in ids), 'jev_correct': sum(P['jev_B'][i] == 'review' == hand[i]['hand'] for i in ids),
    'haiku_B_picks': sum(P['haiku_B'][i] == 'review' for i in ids), 'haiku_B_correct': sum(P['haiku_B'][i] == 'review' == hand[i]['hand'] for i in ids)}
R['cascade_jev_conf_ge_0_8_else_haiku_B'] = {'correct': sum((P['jev_B'][i] if (jev[i].get('confidence') or 0) >= .8 else P['haiku_B'][i]) == hand[i]['hand'] for i in ids),
    'n': len(ids), 'haiku_calls_needed': sum((jev[i].get('confidence') or 0) < .8 for i in ids)}
R['top_misses'] = {k: [[f'{h}->{p}', n] for (h, p), n in Counter((hand[i]['hand'], P[k][i]) for i in ids if P[k][i] != hand[i]['hand']).most_common(5)] for k in ('jev_B', 'haiku_B')}
json.dump(R, open(os.path.join(D, 'results.json'), 'w'), indent=2)
print(json.dumps(R, indent=1))

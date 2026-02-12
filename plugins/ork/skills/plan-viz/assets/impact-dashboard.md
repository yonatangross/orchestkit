# Impact Dashboard Template

## Table Format

```
IMPACT SUMMARY
+==========+==========+============+
| Category | Files    | Lines      |
+==========+==========+============+
| Added    | {{ADD}}  | +{{ADD_L}} |
| Modified | {{MOD}}  | +{{MOD_A}} -{{MOD_R}} |
| Deleted  | {{DEL}}  | -{{DEL_L}} |
+----------+----------+------------+
| NET      | {{NET_F}}| {{NET_L}}  |
+----------+----------+------------+

Tests:    {{NEW_TESTS}} new  |  {{MOD_TESTS}} modified  |  Coverage: {{COV_BEFORE}}% -> {{COV_AFTER}}% ({{COV_ACTION}})
API:      {{NEW_ENDPOINTS}} new endpoints  |  {{BREAKING}} breaking changes
Deps:     +{{DEPS_ADD}} ({{DEPS_ADD_NAMES}})  |  -{{DEPS_REM}} ({{DEPS_REM_NAMES}})
```

## Bar Chart Format (for large changes)

Use when NET files > 20:

```
IMPACT BY DIRECTORY
src/api/        [========........] +120 -45   (net +75)
src/models/     [======..........] +95         (net +95)
src/services/   [============....] +180        (net +180)
src/tests/      [==========......] +140 -10   (net +130)
docs/           [==..............] +30         (net +30)
                ─────────────────
                Total: +565 -55  (net +510)
```

## Risk-Weighted Impact

When risk varies significantly across files:

```
RISK-WEIGHTED IMPACT
                              Risk    Lines   Score
src/api/routes.py         !! HIGH    +45 -12   8.5
src/services/billing.py   ** NEW     +180       3.0
src/models/invoice.py     ** NEW     +95        2.0
src/api/schemas.py           LOW     +20 -5    1.5
src/tests/test_billing.py ** NEW     +120       1.0

Risk Score = (risk_level * lines_changed) / 100
!! = modifying high-traffic existing code
** = new file (lower risk, no existing behavior to break)
```

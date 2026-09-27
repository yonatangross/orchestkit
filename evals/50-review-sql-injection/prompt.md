---
tags: [lane-0927, review, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

Review this PR diff. The PR title is "refactor: simplify user search query". Give me your verdict
    (approve or request changes) and the findings.


```diff
--- a/api/users.py
+++ b/api/users.py
@@ def search_users(request):
-    rows = db.execute("SELECT id, email FROM users WHERE org_id = %s AND email LIKE %s",
-                      (request.org_id, f"%{request.args['q']}%"))
+    q = request.args["q"]
+    rows = db.execute(f"SELECT id, email FROM users WHERE org_id = {request.org_id} "
+                      f"AND email LIKE '%{q}%'")
     return jsonify([dict(r) for r in rows])
```

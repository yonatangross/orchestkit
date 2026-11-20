---
tags: [lane-0927, review, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

Review this diff before I merge it. PR title: "perf: send reminders in parallel".


```diff
--- a/src/jobs/sendReminders.ts
+++ b/src/jobs/sendReminders.ts
@@ export async function sendReminders(users: User[]) {
-  for (const u of users) {
-    await mailer.send(u.email, reminderTemplate(u));
-  }
+  users.forEach(async (u) => {
+    await mailer.send(u.email, reminderTemplate(u));
+  });
   await db.markRemindersSent(users.map((u) => u.id));
 }
--- a/src/jobs/sendReminders.test.ts
+++ b/src/jobs/sendReminders.test.ts
+it("sends reminders", async () => {
+  await sendReminders([alice, bob]);
+  expect(true).toBe(true);
+});
```

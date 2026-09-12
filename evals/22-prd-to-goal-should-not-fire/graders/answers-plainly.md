---
type: llm
focus: last_message
weight: 1
---
The user asked a short conceptual question about feature flag kill switches.
Score the response against ALL of these claims:

1. It explains that a kill switch disables a feature at runtime without shipping
   new code, whereas a rollback redeploys a previous build.
2. It says when a kill switch is the better choice, for example when the bad
   behaviour is confined to one flagged feature or when a redeploy is slow or
   risky.
3. It stays close to the one-paragraph length the user asked for and does not
   turn the answer into a spec-decomposition exercise.

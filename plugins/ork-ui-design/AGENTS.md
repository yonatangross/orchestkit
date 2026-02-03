# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-ui-design Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# Frontend & UI
|frontend-ui-developer:{frontend-ui-developer.md}|React,TypeScript,component,UI,frontend,optimistic updates,Zod,concurrent,TSX,hook,TanStack,Suspense,skeleton,form,validation,mutation,lazy loading,view transitions,scroll animations,PWA,charts,dashboard
|rapid-ui-designer:{rapid-ui-designer.md}|UI,UX,prototype,Tailwind,design system,component,mockup
|# Product & Strategy
|ux-researcher:{ux-researcher.md}|user research,persona,user journey,usability,user testing,insights
```

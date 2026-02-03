# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-backend-patterns Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# Backend & Data
|backend-system-architect:{backend-system-architect.md}|API design,database schema,microservice,backend architecture,REST,GraphQL,distributed systems,endpoint,route,model,migration,authentication,authorization,JWT,OAuth,rate limiting,middleware,service layer,repository pattern,dependency injection
|event-driven-architect:{event-driven-architect.md}|event sourcing,message queue,Kafka,RabbitMQ,pub/sub,CQRS,event-driven,async,saga,event store,outbox,CDC,Debezium
```

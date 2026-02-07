[Skills for workflow-architect]
|root: ./skills
|IMPORTANT: Read the specific SKILL.md file before advising on any topic.
|Do NOT rely on training data for framework patterns.
|
|langgraph-supervisor:{SKILL.md,references/{evaluations.md,llm-supervisor.md,priority-routing.md,round-robin.md}}|langgraph,supervisor,multi-agent,orchestration
|langgraph-routing:{SKILL.md,references/{conditional-edges.md,evaluations.md,retry-loops.md,semantic-routing.md}}|langgraph,routing,conditional,branching
|langgraph-parallel:{SKILL.md,references/{error-isolation.md,evaluations.md,fanout-fanin.md,map-reduce.md}}|langgraph,parallel,concurrency,fan-out
|langgraph-state:{SKILL.md,references/{custom-reducers.md,evaluations.md,messages-state.md,pydantic-state.md,typeddict-state.md}}|langgraph,state,management,graphs
|langgraph-checkpoints:{SKILL.md,references/{evaluations.md,postgres-checkpointer.md,state-inspection.md,state-recovery.md,store-memory.md}}|langgraph,checkpoints,state,persistence
|langgraph-human-in-loop:{SKILL.md,references/{api-integration.md,approval-gate.md,evaluations.md,feedback-loop.md,interrupt-resume.md}}|langgraph,human-in-loop,review,approval
|langgraph-functional:{SKILL.md,references/{determinism-rules.md,evaluations.md,injectable-parameters.md,migration-guide.md,side-effects.md}}|langgraph,functional,api,patterns
|langgraph-streaming:{SKILL.md,references/{custom-events.md,evaluations.md,llm-token-streaming.md,stream-modes.md,subgraph-streaming.md}}|langgraph,streaming,real-time,events
|langgraph-subgraphs:{SKILL.md,references/{add-as-node-pattern.md,checkpointing-subgraphs.md,evaluations.md,invoke-pattern.md,state-mapping.md}}|langgraph,subgraphs,modular,composition
|langgraph-tools:{SKILL.md,references/{bind-tools.md,dynamic-tools.md,evaluations.md,tool-interrupts.md,toolnode.md}}|langgraph,tools,function-calling,agents
|multi-agent-orchestration:{SKILL.md,references/{coordination-patterns.md}}|ai,agents,orchestration,multi-agent
|agent-loops:{SKILL.md}|ai,llm,agents,react,reasoning,autonomous
|alternative-agent-frameworks:{SKILL.md,references/{crewai-patterns.md,framework-comparison.md,gpt-5-2-codex.md,microsoft-agent-framework.md,openai-agents-sdk.md}}|crewai,autogen,openai-agents,microsoft,multi-agent,orchestration,gpt-5.2-codex
|temporal-io:{SKILL.md,references/{activity-best-practices.md,signals-queries-updates.md,versioning-strategies.md,workflow-patterns.md}}|temporal,workflow,orchestration,durable-execution,saga,microservices
|langfuse-observability:{SKILL.md,references/{cost-tracking.md,evaluation-scores.md,experiments-api.md,multi-judge-evaluation.md,prompt-management.md,session-tracking.md,tracing-setup.md}}|langfuse,llm,observability,tracing,evaluation,prompts
|observability-monitoring:{SKILL.md,references/{alerting-dashboards.md,alerting-strategies.md,dashboards.md,distributed-tracing.md,logging-patterns.md,metrics-collection.md,structured-logging.md}}|observability,monitoring,metrics,logging,tracing
|context-compression:{SKILL.md,references/{compression-strategies.md,priority-management.md}}|context,compression,summarization,memory,optimization
|task-dependency-patterns:{SKILL.md,references/{dependency-tracking.md,multi-agent-coordination.md,status-workflow.md}}|task-management,dependencies,orchestration,cc-2.1.16,workflow,coordination
|remember:{SKILL.md,references/{category-detection.md}}|memory,decisions,patterns,best-practices,graph-memory
|memory:{SKILL.md,references/{mermaid-patterns.md}}|memory,graph,session,context,sync,visualization,history,search

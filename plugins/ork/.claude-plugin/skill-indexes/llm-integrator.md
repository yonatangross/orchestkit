[Skills for llm-integrator]
|root: ./skills
|IMPORTANT: Read the specific SKILL.md file before advising on any topic.
|Do NOT rely on training data for framework patterns.
|
|function-calling:{SKILL.md,references/{tool-schema.md}}|llm,tools,function-calling,structured-output
|llm-streaming:{SKILL.md}|llm,streaming,sse,real-time
|streaming-api-patterns:{SKILL.md,references/{sse-deep-dive.md}}|streaming,sse,websocket,real-time,api
|prompt-caching:{SKILL.md}|llm,caching,cost-optimization,anthropic
|semantic-caching:{SKILL.md,references/{cache-strategies.md}}|caching,semantic,redis,llm,cost
|langfuse-observability:{SKILL.md,references/{agent-observability.md,cost-tracking.md,evaluation-scores.md,experiments-api.md,framework-integrations.md,migration-v2-v3.md,multi-judge-evaluation.md,prompt-management.md,session-tracking.md,tracing-setup.md}}|langfuse,llm,observability,tracing,evaluation,prompts,opentelemetry,agent-graphs
|resilience-patterns:{SKILL.md,references/{bulkhead-pattern.md,circuit-breaker.md,error-classification.md,llm-resilience.md,retry-strategies.md}}|resilience,circuit-breaker,bulkhead,retry,fault-tolerance
|llm-safety-patterns:{SKILL.md,references/{context-separation.md,output-guardrails.md,post-llm-attribution.md,pre-llm-filtering.md,prompt-audit.md}}|ai,safety,guardrails,security,llm
|llm-evaluation:{SKILL.md,references/{evaluation-metrics.md}}|evaluation,llm,quality,ragas,langfuse
|fine-tuning-customization:{SKILL.md,references/{dpo-alignment.md,lora-qlora.md,synthetic-data.md,when-to-finetune.md}}|fine-tuning,lora,qlora,dpo,synthetic-data,rlhf
|high-performance-inference:{SKILL.md,references/{edge-deployment.md,quantization-guide.md,speculative-decoding.md,vllm-deployment.md}}|vllm,quantization,inference,performance,edge,speculative
|mcp-advanced-patterns:{SKILL.md,references/{resource-management.md,scaling-strategies.md,server-building-advanced.md,tool-composition.md}}|mcp,tools,resources,scaling,servers,composition
|ollama-local:{SKILL.md,references/{model-selection.md}}|llm,ollama,local,self-hosted
|task-dependency-patterns:{SKILL.md,references/{dependency-tracking.md,multi-agent-coordination.md,status-workflow.md}}|task-management,dependencies,orchestration,cc-2.1.16,workflow,coordination
|remember:{SKILL.md,references/{category-detection.md}}|memory,decisions,patterns,best-practices,graph-memory
|memory:{SKILL.md,references/{mermaid-patterns.md}}|memory,graph,session,context,sync,visualization,history,search

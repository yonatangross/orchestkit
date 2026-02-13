[Skills for code-quality-reviewer]
|root: ./skills
|IMPORTANT: Read the specific SKILL.md file before advising on any topic.
|Do NOT rely on training data for framework patterns.
|
|code-review-playbook:{SKILL.md,references/{review-patterns.md}}|code-review,quality,collaboration,best-practices
|security-patterns:{SKILL.md,references/{audit-logging.md,context-separation.md,langfuse-mask-callback.md,llm-guard-sanitization.md,logging-redaction.md,oauth-2.1-passkeys.md,output-guardrails.md,post-llm-attribution.md,pre-llm-filtering.md,presidio-integration.md,prompt-audit.md,request-context-pattern.md,tenant-isolation.md,vulnerability-demos.md,zod-v4-api.md}}|security,authentication,authorization,defense-in-depth,owasp,input-validation,llm-safety,pii-masking,jwt,oauth
|testing-patterns:{SKILL.md,references/{a11y-testing-tools.md,aaa-pattern.md,consumer-tests.md,custom-plugins.md,deepeval-ragas-api.md,factory-patterns.md,generator-agent.md,healer-agent.md,k6-patterns.md,msw-2x-api.md,pact-broker.md,planner-agent.md,playwright-1.57-api.md,playwright-setup.md,provider-verification.md,stateful-testing.md,strategies-guide.md,visual-regression.md,xdist-parallel.md}}|testing,unit,integration,e2e,pytest,msw,vcr,property,contract,performance,llm,a11y
|evidence-verification:{SKILL.md,references/{evidence-patterns.md}}|quality,verification,testing,evidence,completion
|distributed-systems:{SKILL.md,references/{bulkhead-pattern.md,circuit-breaker.md,error-classification.md,llm-resilience.md,postgres-advisory-locks.md,redis-locks.md,redlock-algorithm.md,retry-strategies.md,stripe-pattern.md,token-bucket-algorithm.md}}|distributed-systems,distributed-locks,resilience,circuit-breaker,idempotency,rate-limiting,retry,fault-tolerance
|architecture-patterns:{SKILL.md,references/{backend-dependency-injection.md,backend-layer-separation.md,backend-naming-exceptions.md,clean-ddd-tactical-patterns.md,clean-hexagonal-ports-adapters.md,clean-solid-dependency-rule.md,dependency-injection.md,hexagonal-architecture.md,layer-rules.md,naming-conventions.md,structure-folder-conventions.md,structure-import-direction.md,testing-aaa-isolation.md,testing-coverage-location.md,testing-naming-conventions.md,violation-examples.md}}|architecture,clean-architecture,validation,structure,enforcement,testing-standards
|quality-gates:{SKILL.md,references/{blocking-thresholds.md,complexity-scoring.md,gate-patterns.md,llm-quality-validation.md,workflows.md}}|quality,complexity,planning,escalation,blocking
|biome-linting:{SKILL.md,references/{biome-json-config.md,ci-integration.md,eslint-migration.md,type-aware-rules.md}}|biome,linting,formatting,eslint-migration,ci,code-quality,typescript
|best-practices:{SKILL.md,references/{proactive-warnings.md}}|best-practices,patterns,anti-patterns,learning
|remember:{SKILL.md,references/{category-detection.md}}|memory,decisions,patterns,best-practices,graph-memory
|memory:{SKILL.md,references/{mermaid-patterns.md}}|memory,graph,session,context,sync,visualization,history,search

/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:brainstorm skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const brainstormDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "brainstorm",
  skillCommand: "/ork:brainstorm",
  hook: "Generate ideas in parallel. 4 specialists. Synthesis included.",
  primaryColor: "#f59e0b",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Spawn Agents", shortName: "Spawn" },
    { name: "Generate Ideas", shortName: "Ideas" },
    { name: "Evaluate", shortName: "Eval" },
    { name: "Synthesize", shortName: "Synthesize" },
  ],

  // SIMPLE LEVEL - Single domain ideation
  simple: {
    name: "Simple",
    description: "brainstorm UI form validation",
    inputCount: 1,
    files: [
      {
        name: "brainstorm/",
        status: "completed",
        children: [
          { name: "ui-validation-ideas.md", status: "completed", lines: 78 },
        ],
      },
    ],
    references: [
      { name: "design-thinking", status: "loaded", category: "ux" },
      { name: "form-validation-patterns", status: "loaded", category: "frontend" },
    ],
    claudeResponse: [
      "Brainstorming form validation approaches:",
      "",
      "• Spawning 4 specialist agents",
      "• UX Designer: User experience",
      "• Backend Engineer: Data validation",
      "• Performance Specialist: Speed",
      "• Security Specialist: Safety",
    ],
    codeSnippet: `BRAINSTORM SYNTHESIS REPORT
──────────────────────────
Topic: UI Form Validation

🎨 UX DESIGNER IDEAS:
✓ Real-time validation feedback (keyup)
✓ Inline error messages with icons
✓ Visual field states (error, warning, success)
✓ Progressive disclosure of validations

💻 BACKEND ENGINEER IDEAS:
✓ Server-side validation always
✓ Zod schema for type safety
✓ Batch validation endpoint
✓ Custom async validators (email exists)

⚡ PERFORMANCE SPECIALIST IDEAS:
✓ Debounced validation (300ms)
✓ Lazy validation for non-critical fields
✓ Caching validation results
✓ Web Worker for heavy validation

🔒 SECURITY SPECIALIST IDEAS:
✓ XSS protection in error messages
✓ Rate limit validation attempts
✓ Sanitize user input before validation
✓ CSP headers for form context

SYNTHESIS:
→ Implement hybrid validation:
  • Client: Real-time UX feedback (debounced)
  • Server: Source of truth validation
  • Schema: Zod for isomorphic typing
  • Performance: Memoized validators
  • Security: Sanitize + Rate limit

Top 3 Recommendations (Vote Score):
1. Hybrid validation pattern (8.5/10)
2. Async email existence check (7.8/10)
3. Batch validation endpoint (7.2/10)`,
    completionTime: "18s",
    metrics: {
      Agents: "4",
      Ideas: "16",
      Synthesis: "1",
    },
  },

  // MEDIUM LEVEL - Feature ideation
  medium: {
    name: "Medium",
    description: "brainstorm user notification system",
    inputCount: 6,
    files: [
      {
        name: "brainstorm/",
        status: "completed",
        children: [
          { name: "notification-ideas.md", status: "completed", lines: 156 },
          { name: "architecture-options.md", status: "completed", lines: 123 },
          { name: "priority-matrix.md", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "design-thinking", status: "loaded", category: "ux" },
      { name: "notification-patterns", status: "loaded", category: "systems" },
      { name: "real-time-architecture", status: "loading", category: "backend" },
    ],
    claudeResponse: [
      "Brainstorming notification system design:",
      "",
      "• Spawning 5 specialist agents",
      "• Product Manager: User experience",
      "• Backend Architect: System design",
      "• Mobile Engineer: Push notifications",
      "• Database Specialist: Scalability",
      "• Security Specialist: Privacy",
    ],
    codeSnippet: `BRAINSTORM SYNTHESIS REPORT
──────────────────────────
Topic: User Notification System

📊 PRODUCT MANAGER IDEAS:
✓ In-app notifications (bell icon)
✓ Email digest (daily/weekly)
✓ Push notifications (iOS/Android)
✓ SMS for critical alerts
✓ Notification preferences per user
✓ Notification center/history

🏗️ BACKEND ARCHITECT IDEAS:
✓ Event-driven architecture
✓ Message queue (RabbitMQ/Kafka)
✓ Pub/Sub pattern with Redis
✓ Template system for emails
✓ Retry mechanism (exponential backoff)
✓ Dead letter queue for failures

📱 MOBILE ENGINEER IDEAS:
✓ Firebase Cloud Messaging
✓ Badge counter on app icon
✓ Custom notification sounds
✓ Action buttons in notifications
✓ Notification grouping/summary
✓ Deep linking to context

🗄️ DATABASE SPECIALIST IDEAS:
✓ Notifications table (indexed by user_id, read_at)
✓ Preference settings table
✓ Audit trail for delivery status
✓ Partitioning by date for archive
✓ Caching read/unread counts
✓ ETL for notification analytics

🔒 SECURITY SPECIALIST IDEAS:
✓ Encrypt sensitive notification data
✓ End-to-end for sensitive alerts
✓ Audit all notification sends
✓ Rate limit per user (spam protection)
✓ Verify email before sending
✓ GDPR compliance (right to delete)

SYNTHESIS & RECOMMENDATION:
→ Recommended Architecture:
  ┌─ Event Source
  │  └─ User actions trigger events
  ├─ Message Queue (Kafka)
  │  └─ Decouple notification service
  ├─ Notification Service
  │  ├─ Email (Sendgrid)
  │  ├─ Push (Firebase)
  │  ├─ SMS (Twilio)
  │  └─ In-app (WebSocket)
  └─ Database
     ├─ Notifications log
     └─ User preferences

Implementation Roadmap:
1. Phase 1: In-app notifications (2 weeks)
2. Phase 2: Email digest (3 weeks)
3. Phase 3: Push notifications (2 weeks)
4. Phase 4: SMS + preferences (2 weeks)

Top 5 Ideas by Vote Score:
1. Event-driven pub/sub architecture (9.2/10)
2. User notification preferences (8.9/10)
3. Email digest template system (8.6/10)
4. Real-time in-app via WebSocket (8.4/10)
5. Notification delivery audit trail (8.1/10)`,
    completionTime: "45s",
    metrics: {
      Agents: "5",
      Ideas: "28",
      Recommendations: "5",
    },
  },

  // ADVANCED LEVEL - Complex system ideation
  advanced: {
    name: "Advanced",
    description: "brainstorm AI-powered content recommendation",
    inputCount: 15,
    files: [
      {
        name: "brainstorm/",
        status: "completed",
        children: [
          { name: "recommendation-ideas.md", status: "completed", lines: 234 },
          { name: "ml-approaches.md", status: "completed", lines: 178 },
          { name: "infrastructure.md", status: "completed", lines: 145 },
          { name: "roadmap.md", status: "completed", lines: 123 },
        ],
      },
    ],
    references: [
      { name: "design-thinking", status: "loaded", category: "strategy" },
      { name: "recommendation-systems", status: "loaded", category: "ml" },
      { name: "ml-infrastructure", status: "loaded", category: "ml-ops" },
      { name: "personalization-patterns", status: "loading", category: "ux" },
      { name: "large-scale-systems", status: "pending", category: "architecture" },
    ],
    claudeResponse: [
      "Brainstorming enterprise AI recommendation system:",
      "",
      "• Spawning 7 specialist agents",
      "• Product Manager: User experience & strategy",
      "• ML Engineer: Algorithms & models",
      "• Backend Architect: System design & scalability",
      "• Data Engineer: Pipeline & infrastructure",
      "• Security Specialist: Privacy & compliance",
      "• DevOps Engineer: Deployment & monitoring",
      "• Analytics Specialist: Metrics & ROI",
    ],
    codeSnippet: `BRAINSTORM SYNTHESIS REPORT
──────────────────────────
Topic: AI-Powered Content Recommendation Engine

📊 PRODUCT MANAGER IDEAS:
✓ Personalized feed (TikTok/Netflix style)
✓ Trending content section
✓ User preferences configuration
✓ Recommendation explanation UI
✓ A/B testing framework for algorithms
✓ User feedback loop (rate content)
✓ Cold start solution for new users
✓ Diverse serendipity recommendations

🤖 ML ENGINEER IDEAS:
✓ Collaborative filtering (user-based)
✓ Content-based filtering (item features)
✓ Hybrid approach combining both
✓ Deep learning with embeddings
✓ Contextual bandits for exploration
✓ Reinforcement learning for long-term value
✓ Real-time ranking with LTR model
✓ Cold start strategy: popularity + metadata

💾 DATA ENGINEER IDEAS:
✓ Feature store (Feast/Tecton)
✓ Data pipeline (Spark/Airflow)
✓ Real-time streaming (Kafka)
✓ Data lake for analytics (S3/Delta)
✓ Embedding storage (Milvus/Weaviate)
✓ User behavior tracking
✓ Content metadata indexing
✓ Near real-time data freshness

🏗️ BACKEND ARCHITECT IDEAS:
✓ Microservice for recommendations
✓ Caching layer (Redis) for top-K results
✓ Batch pre-computation for popular users
✓ Real-time serving with low latency
✓ Fallback to popularity-based
✓ Request deduplication
✓ Circuit breaker for ML service
✓ A/B testing infrastructure

🔒 SECURITY & PRIVACY IDEAS:
✓ Differential privacy for user data
✓ Anonymize recommendations
✓ Filter illegal/harmful content
✓ Audit trail for recommendations
✓ GDPR right to explanation
✓ Opt-out of personalization
✓ Content filtering (parental controls)
✓ Rate limiting per user

🛠️ DEVOPS ENGINEER IDEAS:
✓ ML model versioning (MLflow)
✓ Automated retraining pipeline (weekly)
✓ Canary deployments for models
✓ Model monitoring & drift detection
✓ A/B testing infrastructure
✓ Metrics dashboard (Grafana)
✓ Latency SLO (p99 < 500ms)
✓ Cost optimization (batch processing)

📈 ANALYTICS SPECIALIST IDEAS:
✓ Recommendation CTR metric
✓ User engagement lift measurement
✓ Diversity score (avoid filter bubble)
✓ Serendipity score (unexpected but relevant)
✓ Session-based metrics
✓ Business ROI metrics (revenue impact)
✓ Model performance benchmarking
✓ User satisfaction surveys

SYNTHESIS & RECOMMENDED APPROACH:
→ Hybrid Architecture (Winner - 9.1/10):

Phase 1: Quick Win (Week 1-2)
├─ Popularity-based recommendations
├─ Content-based filtering (metadata)
└─ Deployed with Redis caching

Phase 2: Personalization (Week 3-4)
├─ Collaborative filtering algorithm
├─ User behavior tracking
├─ Feature store setup
└─ A/B testing infrastructure

Phase 3: Advanced ML (Week 5-8)
├─ Deep learning with embeddings
├─ Real-time ranking (LTR model)
├─ Contextual bandits for exploration
└─ Online learning loop

Phase 4: Enterprise (Week 9-12)
├─ Reinforcement learning
├─ Responsible AI (bias detection)
├─ Privacy-preserving personalization
└─ Cross-domain recommendations

Technology Stack:
Backend: Node.js + FastAPI (ML)
ML: TensorFlow/PyTorch + Hugging Face
Data: Kafka → Spark → Feature Store (Feast)
Serving: Milvus (embeddings) + Redis (cache)
Monitoring: Prometheus/Grafana + Weights&Biases

Infrastructure Estimate:
├─ ML Training: 4 GPU instances (cost: $2.5k/month)
├─ Feature Store: PostgreSQL + Cache (cost: $0.5k/month)
├─ Serving: Auto-scaled containers (cost: $1.2k/month)
└─ Analytics: Data warehouse (cost: $0.8k/month)
Total: ~$5k/month for enterprise scale

Top 10 Ideas by Vote Score:
1. Hybrid collaborative + content filtering (9.4/10)
2. Real-time ranking with LTR models (9.2/10)
3. Feature store for centralized ML (9.0/10)
4. Contextual bandits for exploration (8.8/10)
5. Automated model retraining pipeline (8.7/10)
6. Explanation UI for transparency (8.6/10)
7. Differential privacy for protection (8.4/10)
8. A/B testing framework integration (8.3/10)
9. Serendipity & diversity scoring (8.1/10)
10. Cost optimization via batch processing (7.9/10)

Risks & Mitigation:
⚠️ Risk: Cold start for new users
   → Solution: Content-based + popularity fallback
⚠️ Risk: Filter bubble (low diversity)
   → Solution: Serendipity score + exploration
⚠️ Risk: Privacy concerns
   → Solution: Differential privacy + anonymization
⚠️ Risk: Model staleness
   → Solution: Automated weekly retraining
⚠️ Risk: High infra costs
   → Solution: Batch pre-computation + caching`,
    completionTime: "2m 34s",
    metrics: {
      Agents: "7",
      Ideas: "56",
      Recommendations: "10",
      Roadmap: "4-phases",
    },
  },

  summaryTitle: "💡 BRAINSTORM COMPLETE",
  summaryTagline: "7 specialists. 56 ideas. Prioritized roadmap. Let's build.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default brainstormDemoConfig;

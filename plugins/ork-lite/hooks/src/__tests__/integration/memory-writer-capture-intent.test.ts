/**
 * Integration Tests: buildGraphOperations with Multi-Constraint/Tradeoff Scenarios
 *
 * Tests the graph operation building in realistic decision capture scenarios
 * with multiple constraints and tradeoffs from user prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  buildGraphOperations,
  DecisionRecord,
} from '../../lib/memory-writer.js';

// =============================================================================
// REALISTIC SCENARIO BUILDERS
// =============================================================================

/**
 * Build a decision from a user intent detection result
 * Simulates what capture-user-intent.ts does
 */
function buildDecisionFromUserIntent(
  what: string,
  why?: string,
  alternatives?: string[],
  constraints?: string[],
  tradeoffs?: string[],
  entities?: string[]
): DecisionRecord {
  return {
    id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'decision',
    content: {
      what,
      ...(why && { why }),
      ...(alternatives?.length && { alternatives }),
      ...(constraints?.length && { constraints }),
      ...(tradeoffs?.length && { tradeoffs }),
    },
    entities: entities || [],
    relations: [],
    identity: {
      user_id: 'test@example.com',
      anonymous_id: 'anon-test',
      team_id: 'test-team',
      machine_id: 'test-machine',
    },
    metadata: {
      session_id: 'session-test',
      timestamp: new Date().toISOString(),
      confidence: 0.85,
      source: 'user_prompt',
      project: 'test-project',
      category: 'architecture',
    },
  };
}

/**
 * Helper to count operation payloads
 */
function countPayloads(
  operations: ReturnType<typeof buildGraphOperations>,
  type: string
): number {
  return operations.filter(op => op.type === type).length;
}

/**
 * Extract all relations by type from operations
 */
function getRelationsByType(
  operations: ReturnType<typeof buildGraphOperations>,
  relationType: string
) {
  const createRelOps = operations.filter(op => op.type === 'create_relations');
  const allRelations = createRelOps.flatMap(op => op.payload.relations ?? []);
  return allRelations.filter(r => r.relationType === relationType);
}

// =============================================================================
// INTEGRATION TESTS - MULTI-CONSTRAINT SCENARIOS
// =============================================================================

describe('Integration: buildGraphOperations with Multi-Constraint Scenarios', () => {
  // ===== DATABASE SELECTION DECISION =====

  describe('Real scenario: Database selection with 3+ constraints', () => {
    it('should handle database choice with multiple constraints', () => {
      const decision = buildDecisionFromUserIntent(
        'Use PostgreSQL for primary data store',
        'ACID compliance and JSON support are critical for our use case',
        ['MongoDB', 'MySQL'], // alternatives
        [
          'Must support ACID transactions',
          'Team expertise is limited to SQL databases',
          'Must handle 1M+ records efficiently',
          'Cost per GB must be under $0.50',
        ],
        [
          'Operational complexity is higher than MongoDB',
          'Steeper learning curve for JSON queries',
        ],
        ['PostgreSQL', 'ACID', 'JSON', 'MongoDB']
      );

      const operations = buildGraphOperations(decision);

      // Verify structure
      expect(countPayloads(operations, 'create_entities')).toBe(1);
      expect(countPayloads(operations, 'create_relations')).toBe(1);

      // Verify constraint relations
      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(4);
      expect(constraints.some(c => c.to.includes('ACID'))).toBe(true);
      expect(constraints.some(c => c.to.includes('Team expertise'))).toBe(true);

      // Verify tradeoff relations
      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(2);

      // Verify CHOSE_OVER relations
      const choseOver = getRelationsByType(operations, 'CHOSE_OVER');
      expect(choseOver.length).toBe(2);

      // Verify entity mentions
      const chose = getRelationsByType(operations, 'CHOSE');
      expect(chose.length).toBe(4);
    });

    it('should track entities across constraint relations', () => {
      const decision = buildDecisionFromUserIntent(
        'Adopt PostgreSQL 15',
        'Better performance and features',
        [],
        [
          'Minimum 2 replicas for HA',
          'Connection pooling with pgBouncer',
          'Automated backup to S3',
        ],
        [],
        ['PostgreSQL', 'pgBouncer', 'S3', 'HA']
      );

      const operations = buildGraphOperations(decision);
      const constraints = getRelationsByType(operations, 'CONSTRAINT');

      // All constraints should reference themselves as entities
      expect(constraints.length).toBe(3);
      constraints.forEach(c => {
        expect(c.to).toBeDefined();
        expect(typeof c.to).toBe('string');
      });
    });
  });

  // ===== PAGINATION STRATEGY DECISION =====

  describe('Real scenario: Pagination strategy with multiple tradeoffs', () => {
    it('should handle pagination choice with 4+ tradeoffs', () => {
      const decision = buildDecisionFromUserIntent(
        'Implement cursor-based pagination',
        'Scales better than offset-pagination for large datasets',
        ['offset-pagination', 'keyset-pagination'],
        [
          'Must support sorting on multiple columns',
          'Cannot expose internal IDs to client',
          'Browser back button must work',
        ],
        [
          'More complex client implementation',
          'Requires maintaining cursor state on client',
          'Cannot jump to arbitrary page numbers',
          'Requires stable sort order guarantees',
        ],
        ['cursor-pagination', 'pagination', 'sorting']
      );

      const operations = buildGraphOperations(decision);

      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(4);
      expect(
        tradeoffs.some(t => t.to.includes('More complex client'))
      ).toBe(true);
      expect(
        tradeoffs.some(t => t.to.includes('Cannot jump to arbitrary'))
      ).toBe(true);

      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(3);

      const choseOver = getRelationsByType(operations, 'CHOSE_OVER');
      expect(choseOver.length).toBe(2);
    });

    it('should generate correct entity cross-links for pagination entities', () => {
      const decision = buildDecisionFromUserIntent(
        'cursor-based pagination strategy',
        'Better for large datasets',
        [],
        ['Must support sorting'],
        ['More client complexity'],
        ['cursor-pagination', 'sorting', 'performance']
      );

      const operations = buildGraphOperations(decision);
      const relatesTo = getRelationsByType(operations, 'RELATES_TO');

      // 3 entities = C(3,2) = 3 RELATES_TO relations
      expect(relatesTo.length).toBe(3);

      // Verify pairwise structure
      const pairs = relatesTo.map(r => `${r.from}-${r.to}`);
      expect(pairs).toContain('cursor-pagination-sorting');
      expect(pairs).toContain('cursor-pagination-performance');
      expect(pairs).toContain('sorting-performance');
    });
  });

  // ===== AUTHENTICATION FRAMEWORK DECISION =====

  describe('Real scenario: Auth framework with 5+ constraints', () => {
    it('should handle JWT auth decision with complex constraints', () => {
      const decision = buildDecisionFromUserIntent(
        'Implement JWT-based authentication',
        'Stateless, scalable, and works well with microservices',
        ['Session cookies', 'OAuth2', 'Basic auth'],
        [
          'All services must validate tokens independently',
          'Token refresh strategy must prevent token expiration during active use',
          'Logout must be reflected across all services within 5 minutes',
          'Token payload must not exceed 8KB',
          'Must support role-based access control (RBAC)',
        ],
        [
          'Increased token size in each request',
          'Cannot revoke tokens instantly (stateless)',
          'Client must handle token refresh logic',
          'More complex implementation than cookies',
        ],
        ['JWT', 'authentication', 'RBAC', 'microservices']
      );

      const operations = buildGraphOperations(decision);

      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(5);

      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(4);

      // Verify that constraint content is preserved without truncation
      constraints.forEach(c => {
        expect(c.to.length).toBeGreaterThan(10); // Not truncated
      });
    });
  });

  // ===== INFRASTRUCTURE DECISION =====

  describe('Real scenario: Infrastructure with multiple constraint categories', () => {
    it('should handle Kubernetes adoption with cost/operational/technical constraints', () => {
      const decision = buildDecisionFromUserIntent(
        'Migrate workloads to Kubernetes',
        'Better resource utilization and auto-scaling',
        ['Docker Compose', 'VM-based deployment'],
        [
          'Budget: $50K annually for infrastructure',
          'Team must have 2+ Kubernetes certified engineers',
          'Production SLA: 99.9% uptime',
          'All containers must run as non-root',
          'Logging must centralize to ELK stack',
          'Monitoring must include Prometheus + Grafana',
        ],
        [
          'Operational complexity increases significantly',
          'Debugging distributed issues is more difficult',
          'Network latency for service-to-service communication',
          'Learning curve for team members',
        ],
        ['Kubernetes', 'Docker', 'microservices', 'cloud-native']
      );

      const operations = buildGraphOperations(decision);

      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(6);

      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(4);

      // Check that different constraint categories are all preserved
      const constraintTexts = constraints.map(c => c.to);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('budget'))
      ).toBe(true);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('team'))
      ).toBe(true);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('sla'))
      ).toBe(true);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('non-root'))
      ).toBe(true);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('logging'))
      ).toBe(true);
      expect(
        constraintTexts.some(t => t.toLowerCase().includes('monitoring'))
      ).toBe(true);
    });
  });

  // ===== TESTING FRAMEWORK DECISION =====

  describe('Real scenario: Testing strategy with testing constraints', () => {
    it('should handle unit test framework with coverage constraints', () => {
      const decision = buildDecisionFromUserIntent(
        'Use Vitest for unit testing',
        'ESM native, fast, and better TypeScript integration',
        ['Jest', 'Mocha'],
        [
          'Must maintain 80%+ code coverage',
          'All new code requires tests before merge',
          'Test execution time must be <1s per file',
          'Must support snapshot testing',
          'Must work with current vite.config.ts',
        ],
        [
          'Different config from Jest might confuse team',
          'Fewer StackOverflow answers for debugging',
          'Ecosystem smaller than Jest',
        ],
        ['Vitest', 'Jest', 'testing', 'TypeScript']
      );

      const operations = buildGraphOperations(decision);

      // Should have at least 1 create_entities and 1 create_relations
      expect(countPayloads(operations, 'create_entities')).toBeGreaterThan(0);
      expect(countPayloads(operations, 'create_relations')).toBeGreaterThan(0);

      // Verify coverage constraint is captured
      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(5);
      expect(
        constraints.some(c => c.to.includes('80%+'))
      ).toBe(true);
    });
  });

  // ===== COMPLEX MULTI-CONSTRAINT INTEGRATION =====

  describe('Complex scenario: Full stack decision with 8+ constraints and 5+ tradeoffs', () => {
    it('should handle comprehensive architecture decision', () => {
      const decision = buildDecisionFromUserIntent(
        'Adopt microservices architecture with event-driven communication',
        'Enables independent scaling and faster deployment cycles',
        [
          'Monolithic architecture',
          'Layered monolith',
          'Modular monolith',
        ],
        [
          'Each service must be deployable independently',
          'Maximum inter-service latency: 100ms P99',
          'All events must be immutable and versioned',
          'Dead letter queue for failed events',
          'Message ordering guaranteed per aggregate',
          'Distributed tracing for all requests',
          'Each service owns its database schema',
          'API versioning must support 2 major versions',
        ],
        [
          'Increased operational complexity',
          'Distributed transaction handling is complex',
          'Network latency and partial failure scenarios',
          'DevOps overhead for multiple services',
          'Testing and debugging across services is harder',
        ],
        [
          'microservices',
          'event-driven-architecture',
          'message-queue',
          'Kafka',
          'PostgreSQL',
          'distributed-tracing',
        ]
      );

      const operations = buildGraphOperations(decision);

      // Should create entities operation
      const entitiesOps = countPayloads(operations, 'create_entities');
      expect(entitiesOps).toBe(1);

      // Should create relations operation
      const relationsOps = countPayloads(operations, 'create_relations');
      expect(relationsOps).toBe(1);

      // Verify all constraint types
      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(8);

      // Verify all tradeoffs
      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(5);

      // Verify alternatives
      const choseOver = getRelationsByType(operations, 'CHOSE_OVER');
      expect(choseOver.length).toBe(3);

      // Verify entity mentions
      const chose = getRelationsByType(operations, 'CHOSE');
      expect(chose.length).toBe(6); // 6 entities mentioned

      // Verify cross-links (6 entities = C(6,2) = 15)
      const relatesTo = getRelationsByType(operations, 'RELATES_TO');
      expect(relatesTo.length).toBe(15);

      // Total relations should be: 6 CHOSE + 3 CHOSE_OVER + 8 CONSTRAINT + 5 TRADEOFF + 15 RELATES_TO
      const allRelations = operations
        .filter(op => op.type === 'create_relations')
        .flatMap(op => op.payload.relations ?? []);
      expect(allRelations.length).toBe(6 + 3 + 8 + 5 + 15);
    });
  });

  // ===== CONSTRAINT OBSERVATION PRESERVATION =====

  describe('Constraint text preservation in observations', () => {
    it('should preserve exact constraint wording in observations', () => {
      const uniqueConstraints = [
        'Must handle 10,000 concurrent users with P99 latency < 200ms',
        'Cannot use proprietary cloud services (AWS/Azure only)',
        'Zero-trust security model required',
      ];

      const decision = buildDecisionFromUserIntent(
        'Use open-source stack',
        'Cost and flexibility',
        [],
        uniqueConstraints,
        [],
        []
      );

      const operations = buildGraphOperations(decision);
      const constraints = getRelationsByType(operations, 'CONSTRAINT');

      // Each constraint should be in a relation
      expect(constraints.length).toBe(3);

      // Extract the constraint texts
      const constraintTexts = constraints.map(c => c.to);

      // Verify each unique constraint is preserved
      uniqueConstraints.forEach(constraint => {
        expect(constraintTexts).toContain(constraint);
      });
    });

    it('should preserve exact tradeoff wording', () => {
      const uniqueTradeoffs = [
        'Initial setup time increases from 1 week to 3 weeks',
        'Per-request latency increases by ~50ms due to event processing',
        'Debugging failed transactions requires correlation across logs',
      ];

      const decision = buildDecisionFromUserIntent(
        'Event-driven architecture',
        'Better scalability',
        [],
        [],
        uniqueTradeoffs,
        []
      );

      const operations = buildGraphOperations(decision);
      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');

      const tradeoffTexts = tradeoffs.map(t => t.to);

      uniqueTradeoffs.forEach(tradeoff => {
        expect(tradeoffTexts).toContain(tradeoff);
      });
    });
  });

  // ===== OBSERVATION GENERATION =====

  describe('Observation generation with full context', () => {
    it('should generate comprehensive observations including all decision metadata', () => {
      const decision = buildDecisionFromUserIntent(
        'PostgreSQL for primary storage',
        'ACID compliance required',
        ['MongoDB'],
        [
          'Must support ACID',
          'Team knows SQL',
          'Need JSON support',
        ],
        [
          'More complex setup',
        ],
        ['PostgreSQL']
      );

      const operations = buildGraphOperations(decision);
      const entitiesOps = operations.filter(op => op.type === 'create_entities');
      const mainEntity = entitiesOps[0]?.payload.entities?.[0];

      expect(mainEntity).toBeDefined();
      const obsText = mainEntity?.observations.join('; ') ?? '';

      // Should include decision content in observations
      expect(obsText).toContain('PostgreSQL for primary storage');
      expect(obsText).toContain('ACID compliance required');
      expect(obsText).toContain('MongoDB');
      expect(obsText).toContain('Must support ACID');
      expect(obsText).toContain('Team knows SQL');
      expect(obsText).toContain('Need JSON support');
      // Tradeoff is capitalized in observations
      expect(obsText).toContain('More complex setup');
      // Should include metadata
      expect(obsText).toContain('architecture');
      expect(obsText).toContain('85%');
    });
  });

  // ===== REAL-WORLD CAPTURE SCENARIOS =====

  describe('Real-world capture-user-intent scenarios', () => {
    it('should handle user saying "We chose X because Y, alternatives were Z, but we are constrained by A and B"', () => {
      const decision = buildDecisionFromUserIntent(
        'Redis for caching',
        'In-memory speed needed for sub-100ms response times',
        ['Memcached', 'Local memory cache'],
        [
          'Must persist across restarts',
          'Multi-server cluster needed',
        ],
        [
          'Additional operational overhead',
        ],
        ['Redis', 'caching', 'performance']
      );

      const operations = buildGraphOperations(decision);

      // Verify all components are captured
      expect(getRelationsByType(operations, 'CHOSE').length).toBe(3);
      expect(getRelationsByType(operations, 'CHOSE_OVER').length).toBe(2);
      expect(getRelationsByType(operations, 'CONSTRAINT').length).toBe(2);
      expect(getRelationsByType(operations, 'TRADEOFF').length).toBe(1);
      expect(getRelationsByType(operations, 'RELATES_TO').length).toBe(3);
    });

    it('should handle accumulated constraints from multiple user statements', () => {
      // Simulate progressive constraint discovery
      const constraints = [
        'Budget under $10K/year',
        'Must be open-source',
        'Team has 2 Java experts',
        'Needs Kubernetes integration',
      ];

      const decision = buildDecisionFromUserIntent(
        'Use Keycloak for identity management',
        'Open-source, widely adopted',
        ['Auth0', 'Azure AD'],
        constraints,
        ['Complex initial setup', 'Requires dedicated server'],
        ['Keycloak', 'authentication', 'OIDC']
      );

      const operations = buildGraphOperations(decision);

      const constraintRelations = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraintRelations.length).toBe(4);

      // Verify all constraints are different
      const uniqueConstraints = new Set(
        constraintRelations.map(c => c.to)
      );
      expect(uniqueConstraints.size).toBe(4);
    });
  });

  // ===== EDGE CASE: MANY CONSTRAINTS =====

  describe('Edge case: Many constraints (10+)', () => {
    it('should handle 10 constraints without issues', () => {
      const manyConstraints = [
        'C1: Budget constraint',
        'C2: Team size constraint',
        'C3: Time constraint',
        'C4: Compliance constraint',
        'C5: Performance constraint',
        'C6: Scalability constraint',
        'C7: Security constraint',
        'C8: Integration constraint',
        'C9: Learning curve constraint',
        'C10: Operational constraint',
      ];

      const decision = buildDecisionFromUserIntent(
        'System architecture',
        'Multiple factors',
        [],
        manyConstraints,
        [],
        []
      );

      const operations = buildGraphOperations(decision);

      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      expect(constraints.length).toBe(10);
    });
  });

  // ===== EDGE CASE: MANY TRADEOFFS =====

  describe('Edge case: Many tradeoffs (10+)', () => {
    it('should handle 10 tradeoffs without issues', () => {
      const manyTradeoffs = Array.from({ length: 10 }, (_, i) => `Tradeoff ${i + 1}`);

      const decision = buildDecisionFromUserIntent(
        'Technology choice',
        'Trade-offs analysis',
        [],
        [],
        manyTradeoffs,
        []
      );

      const operations = buildGraphOperations(decision);

      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');
      expect(tradeoffs.length).toBe(10);
    });
  });

  // ===== CONSTRAINT + TRADEOFF INTERACTION =====

  describe('Constraint and tradeoff interaction', () => {
    it('should correctly represent constraints and tradeoffs as different relation types', () => {
      const decision = buildDecisionFromUserIntent(
        'Async task processing',
        'Better scalability',
        [],
        [
          'Constraint: Tasks must complete within 24 hours',
          'Constraint: Must not exceed 100MB memory per worker',
        ],
        [
          'Tradeoff: Debugging async failures is harder',
          'Tradeoff: Additional operational complexity',
        ],
        ['Celery', 'Redis', 'async']
      );

      const operations = buildGraphOperations(decision);

      const constraints = getRelationsByType(operations, 'CONSTRAINT');
      const tradeoffs = getRelationsByType(operations, 'TRADEOFF');

      // Constraints and tradeoffs should be separate
      expect(constraints.length).toBe(2);
      expect(tradeoffs.length).toBe(2);

      // Verify they are actually different types
      const relationTypes = new Set([
        ...constraints.map(c => c.relationType),
        ...tradeoffs.map(t => t.relationType),
      ]);
      expect(relationTypes.has('CONSTRAINT')).toBe(true);
      expect(relationTypes.has('TRADEOFF')).toBe(true);
      expect(relationTypes.size).toBe(2);
    });
  });
});

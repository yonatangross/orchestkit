/**
 * Tests for Unified Memory Writer
 *
 * Comprehensive test coverage for:
 * - buildGraphOperations() - Graph operation building from decisions
 * - createDecisionRecord() - Decision record creation
 * - storeDecision() - Multi-backend storage
 * - Relation generation (CHOSE, CHOSE_OVER, CONSTRAINT, TRADEOFF, RELATES_TO)
 * - Entity type inference
 * - Mem0 payload building
 * - JSONL file operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildGraphOperations,
  createDecisionRecord,
  storeDecision,
  queueGraphOperation,
  isMem0Configured,
  type DecisionRecord,
  type QueuedGraphOperation,
  type GraphEntity,
  type GraphRelation,
  type EntityType,
  type RelationType,
  type DecisionSource,
} from '../../lib/memory-writer.js';

// Mock external dependencies
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
}));

vi.mock('../../lib/user-identity.js', () => ({
  getIdentityContext: vi.fn(() => ({
    user_id: 'test-user@example.com',
    anonymous_id: 'anon-abc123',
    team_id: 'test-team',
    machine_id: 'test-machine',
  })),
  canShare: vi.fn(() => true),
  getUserIdForScope: vi.fn(() => 'test-user'),
  getProjectUserId: vi.fn(() => 'project-test-user'),
  getGlobalScopeId: vi.fn(() => 'global-best-practices'),
}));

vi.mock('../../lib/session-tracker.js', () => ({
  trackDecisionMade: vi.fn(),
  trackPreferenceStated: vi.fn(),
}));

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'decision-test-abc123',
    type: 'decision',
    content: {
      what: 'Use PostgreSQL for the database',
      why: 'Strong ACID compliance and JSON support',
      alternatives: ['MongoDB', 'MySQL'],
      constraints: ['Must support transactions', 'Need JSON querying'],
      tradeoffs: ['Higher memory usage', 'More complex setup'],
    },
    entities: ['PostgreSQL', 'database', 'transactions'],
    relations: [],
    identity: {
      user_id: 'test-user@example.com',
      anonymous_id: 'anon-abc123',
      team_id: 'test-team',
      machine_id: 'test-machine',
    },
    metadata: {
      session_id: 'session-test-123',
      timestamp: '2026-01-29T12:00:00.000Z',
      confidence: 0.85,
      source: 'user_prompt',
      project: 'test-project',
      category: 'database',
      importance: 'high',
      is_generalizable: true,
      sharing_scope: 'team',
    },
    ...overrides,
  };
}

function countRelations(operations: QueuedGraphOperation[], type: RelationType): number {
  const relationsOp = operations.find(op => op.type === 'create_relations');
  if (!relationsOp || !relationsOp.payload.relations) return 0;
  return relationsOp.payload.relations.filter(r => r.relationType === type).length;
}

function hasRelation(
  operations: QueuedGraphOperation[],
  from: string,
  to: string,
  type: RelationType
): boolean {
  const relationsOp = operations.find(op => op.type === 'create_relations');
  if (!relationsOp || !relationsOp.payload.relations) return false;
  return relationsOp.payload.relations.some(
    r => r.from === from && r.to === to && r.relationType === type
  );
}

function getEntities(operations: QueuedGraphOperation[]): GraphEntity[] {
  const entitiesOp = operations.find(op => op.type === 'create_entities');
  return entitiesOp?.payload.entities || [];
}

// =============================================================================
// buildGraphOperations() Tests
// =============================================================================

describe('buildGraphOperations', () => {
  describe('entity creation', () => {
    it('should create main decision entity', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === 'decision-test-abc123');

      expect(mainEntity).toBeDefined();
      expect(mainEntity?.entityType).toBe('Decision');
      expect(mainEntity?.observations).toContain('What: Use PostgreSQL for the database');
    });

    it('should create entities for mentioned technologies', () => {
      const decision = createMockDecision({
        entities: ['PostgreSQL', 'Redis', 'FastAPI'],
      });
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      expect(entities.some(e => e.name === 'PostgreSQL')).toBe(true);
      expect(entities.some(e => e.name === 'Redis')).toBe(true);
      expect(entities.some(e => e.name === 'FastAPI')).toBe(true);
    });

    it('should infer Technology type for known technologies', () => {
      const decision = createMockDecision({
        entities: ['PostgreSQL', 'Redis', 'React'],
      });
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const postgresEntity = entities.find(e => e.name === 'PostgreSQL');
      const redisEntity = entities.find(e => e.name === 'Redis');
      const reactEntity = entities.find(e => e.name === 'React');

      expect(postgresEntity?.entityType).toBe('Technology');
      expect(redisEntity?.entityType).toBe('Technology');
      expect(reactEntity?.entityType).toBe('Technology');
    });

    it('should infer Pattern type for known patterns', () => {
      const decision = createMockDecision({
        entities: ['cursor-pagination', 'cqrs', 'saga-pattern'],
      });
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const paginationEntity = entities.find(e => e.name === 'cursor-pagination');
      const cqrsEntity = entities.find(e => e.name === 'cqrs');
      const sagaEntity = entities.find(e => e.name === 'saga-pattern');

      expect(paginationEntity?.entityType).toBe('Pattern');
      expect(cqrsEntity?.entityType).toBe('Pattern');
      expect(sagaEntity?.entityType).toBe('Pattern');
    });

    it('should infer Tool type for known tools', () => {
      // Note: jest/pytest are testing frameworks (Technology), not CLI tools
      // Use actual tools: git, npm, bash, grep
      const decision = createMockDecision({
        entities: ['git', 'npm', 'bash'],
      });
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const gitEntity = entities.find(e => e.name === 'git');
      const npmEntity = entities.find(e => e.name === 'npm');
      const bashEntity = entities.find(e => e.name === 'bash');

      expect(gitEntity?.entityType).toBe('Tool');
      expect(npmEntity?.entityType).toBe('Tool');
      expect(bashEntity?.entityType).toBe('Tool');
    });
  });

  describe('observation building', () => {
    it('should include what in observations', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === decision.id);

      expect(mainEntity?.observations).toContain('What: Use PostgreSQL for the database');
    });

    it('should include rationale when provided', () => {
      const decision = createMockDecision({
        content: {
          what: 'Use Redis for caching',
          why: 'Sub-millisecond latency needed',
        },
      });
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === decision.id);

      expect(mainEntity?.observations).toContain('Rationale: Sub-millisecond latency needed');
    });

    it('should include alternatives when provided', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === decision.id);

      expect(mainEntity?.observations.some(o => o.includes('Alternatives considered: MongoDB, MySQL'))).toBe(true);
    });

    it('should include constraints when provided', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === decision.id);

      expect(mainEntity?.observations.some(o => o.includes('Constraints:'))).toBe(true);
    });

    it('should include metadata fields', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      const entities = getEntities(operations);
      const mainEntity = entities.find(e => e.name === decision.id);

      expect(mainEntity?.observations.some(o => o.includes('Category: database'))).toBe(true);
      expect(mainEntity?.observations.some(o => o.includes('Confidence: 85%'))).toBe(true);
      expect(mainEntity?.observations.some(o => o.includes('Source: user_prompt'))).toBe(true);
    });
  });

  describe('relation creation', () => {
    describe('CHOSE relations', () => {
      it('should create CHOSE relations for decision type', () => {
        const decision = createMockDecision({
          type: 'decision',
          entities: ['PostgreSQL', 'Redis'],
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, decision.id, 'PostgreSQL', 'CHOSE')).toBe(true);
        expect(hasRelation(operations, decision.id, 'Redis', 'CHOSE')).toBe(true);
      });

      it('should create PREFERS relations for preference type', () => {
        const decision = createMockDecision({
          type: 'preference',
          entities: ['TypeScript', 'strict-mode'],
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, decision.id, 'TypeScript', 'PREFERS')).toBe(true);
        expect(hasRelation(operations, decision.id, 'strict-mode', 'PREFERS')).toBe(true);
      });

      it('should create MENTIONS relations for pattern type', () => {
        const decision = createMockDecision({
          type: 'pattern',
          entities: ['clean-architecture', 'dependency-injection'],
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, decision.id, 'clean-architecture', 'MENTIONS')).toBe(true);
        expect(hasRelation(operations, decision.id, 'dependency-injection', 'MENTIONS')).toBe(true);
      });
    });

    describe('CHOSE_OVER relations', () => {
      it('should create CHOSE_OVER for alternatives', () => {
        const decision = createMockDecision({
          content: {
            what: 'PostgreSQL',
            alternatives: ['MongoDB', 'MySQL', 'SQLite'],
          },
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, 'PostgreSQL', 'MongoDB', 'CHOSE_OVER')).toBe(true);
        expect(hasRelation(operations, 'PostgreSQL', 'MySQL', 'CHOSE_OVER')).toBe(true);
        expect(hasRelation(operations, 'PostgreSQL', 'SQLite', 'CHOSE_OVER')).toBe(true);
      });

      it('should not create CHOSE_OVER when no alternatives', () => {
        const decision = createMockDecision({
          content: {
            what: 'PostgreSQL',
            alternatives: [],
          },
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'CHOSE_OVER')).toBe(0);
      });
    });

    describe('CONSTRAINT relations', () => {
      it('should create CONSTRAINT relations', () => {
        const decision = createMockDecision({
          content: {
            what: 'PostgreSQL',
            constraints: ['ACID compliance', 'JSON support needed'],
          },
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, decision.id, 'ACID compliance', 'CONSTRAINT')).toBe(true);
        expect(hasRelation(operations, decision.id, 'JSON support needed', 'CONSTRAINT')).toBe(true);
      });

      it('should not create CONSTRAINT when no constraints', () => {
        const decision = createMockDecision({
          content: {
            what: 'PostgreSQL',
            constraints: undefined,
          },
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'CONSTRAINT')).toBe(0);
      });
    });

    describe('TRADEOFF relations', () => {
      it('should create TRADEOFF relations', () => {
        const decision = createMockDecision({
          content: {
            what: 'PostgreSQL',
            tradeoffs: ['Higher memory', 'Complex setup'],
          },
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, decision.id, 'Higher memory', 'TRADEOFF')).toBe(true);
        expect(hasRelation(operations, decision.id, 'Complex setup', 'TRADEOFF')).toBe(true);
      });
    });

    describe('RELATES_TO relations (O(n²) cross-links)', () => {
      it('should not create RELATES_TO for single entity', () => {
        const decision = createMockDecision({
          entities: ['PostgreSQL'],
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'RELATES_TO')).toBe(0);
      });

      it('should create 1 RELATES_TO for 2 entities', () => {
        const decision = createMockDecision({
          entities: ['PostgreSQL', 'Redis'],
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'RELATES_TO')).toBe(1);
        expect(hasRelation(operations, 'PostgreSQL', 'Redis', 'RELATES_TO')).toBe(true);
      });

      it('should create 3 RELATES_TO for 3 entities', () => {
        const decision = createMockDecision({
          entities: ['PostgreSQL', 'Redis', 'FastAPI'],
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'RELATES_TO')).toBe(3);
      });

      it('should create 6 RELATES_TO for 4 entities', () => {
        const decision = createMockDecision({
          entities: ['PostgreSQL', 'Redis', 'FastAPI', 'Docker'],
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'RELATES_TO')).toBe(6);
      });

      it('should create 10 RELATES_TO for 5 entities', () => {
        const decision = createMockDecision({
          entities: ['A', 'B', 'C', 'D', 'E'],
        });
        const operations = buildGraphOperations(decision);

        expect(countRelations(operations, 'RELATES_TO')).toBe(10);
      });

      it('should verify O(n²) formula: n*(n-1)/2 relations', () => {
        for (let n = 2; n <= 7; n++) {
          const entities = Array.from({ length: n }, (_, i) => `Entity${i}`);
          const decision = createMockDecision({ entities });
          const operations = buildGraphOperations(decision);
          const expected = (n * (n - 1)) / 2;
          expect(countRelations(operations, 'RELATES_TO')).toBe(expected);
        }
      });
    });

    describe('explicit relations', () => {
      it('should include explicit relations from decision.relations', () => {
        const decision = createMockDecision({
          relations: [
            { from: 'PostgreSQL', to: 'performance', type: 'SOLVED_BY' },
            { from: 'Redis', to: 'caching', type: 'MENTIONS' },
          ],
        });
        const operations = buildGraphOperations(decision);

        expect(hasRelation(operations, 'PostgreSQL', 'performance', 'SOLVED_BY')).toBe(true);
        expect(hasRelation(operations, 'Redis', 'caching', 'MENTIONS')).toBe(true);
      });
    });
  });

  describe('operation structure', () => {
    it('should create exactly 2 operations (entities + relations)', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      expect(operations.length).toBe(2);
      expect(operations[0].type).toBe('create_entities');
      expect(operations[1].type).toBe('create_relations');
    });

    it('should include timestamp on all operations', () => {
      const decision = createMockDecision();
      const operations = buildGraphOperations(decision);

      for (const op of operations) {
        expect(op.timestamp).toBeDefined();
        expect(new Date(op.timestamp).toISOString()).toBe(op.timestamp);
      }
    });

    it('should create only entities operation when no relations possible', () => {
      const decision = createMockDecision({
        entities: [],
        content: {
          what: 'Simple decision',
          alternatives: undefined,
          constraints: undefined,
          tradeoffs: undefined,
        },
        relations: [],
      });
      const operations = buildGraphOperations(decision);

      // Only entities operation, no relations
      expect(operations.length).toBe(1);
      expect(operations[0].type).toBe('create_entities');
    });
  });

  describe('entity type mapping', () => {
    it('should map decision type to Decision entity', () => {
      const decision = createMockDecision({ type: 'decision' });
      const operations = buildGraphOperations(decision);
      const mainEntity = getEntities(operations).find(e => e.name === decision.id);
      expect(mainEntity?.entityType).toBe('Decision');
    });

    it('should map preference type to Preference entity', () => {
      const decision = createMockDecision({ type: 'preference' });
      const operations = buildGraphOperations(decision);
      const mainEntity = getEntities(operations).find(e => e.name === decision.id);
      expect(mainEntity?.entityType).toBe('Preference');
    });

    it('should map problem-solution type to Solution entity', () => {
      const decision = createMockDecision({ type: 'problem-solution' });
      const operations = buildGraphOperations(decision);
      const mainEntity = getEntities(operations).find(e => e.name === decision.id);
      expect(mainEntity?.entityType).toBe('Solution');
    });

    it('should map pattern type to Pattern entity', () => {
      const decision = createMockDecision({ type: 'pattern' });
      const operations = buildGraphOperations(decision);
      const mainEntity = getEntities(operations).find(e => e.name === decision.id);
      expect(mainEntity?.entityType).toBe('Pattern');
    });

    it('should map workflow type to Workflow entity', () => {
      const decision = createMockDecision({ type: 'workflow' });
      const operations = buildGraphOperations(decision);
      const mainEntity = getEntities(operations).find(e => e.name === decision.id);
      expect(mainEntity?.entityType).toBe('Workflow');
    });
  });
});

// =============================================================================
// createDecisionRecord() Tests
// =============================================================================

describe('createDecisionRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create record with required fields', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Use PostgreSQL' },
      ['PostgreSQL'],
      { session_id: 'sess-123', source: 'user_prompt' }
    );

    expect(record.type).toBe('decision');
    expect(record.content.what).toBe('Use PostgreSQL');
    expect(record.entities).toEqual(['PostgreSQL']);
    expect(record.metadata.session_id).toBe('sess-123');
    expect(record.metadata.source).toBe('user_prompt');
  });

  it('should generate unique ID with type prefix', () => {
    const record = createDecisionRecord(
      'preference',
      { what: 'Prefer TypeScript' },
      ['TypeScript'],
      { session_id: 'sess-123', source: 'user_prompt' }
    );

    expect(record.id).toMatch(/^preference-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('should include identity context', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Test decision' },
      [],
      { session_id: 'sess-123', source: 'user_prompt' }
    );

    expect(record.identity.user_id).toBe('test-user@example.com');
    expect(record.identity.anonymous_id).toBe('anon-abc123');
    expect(record.identity.team_id).toBe('test-team');
    expect(record.identity.machine_id).toBe('test-machine');
  });

  it('should set timestamp', () => {
    const before = new Date();
    const record = createDecisionRecord(
      'decision',
      { what: 'Test' },
      [],
      { session_id: 'sess-123', source: 'user_prompt' }
    );
    const after = new Date();

    const timestamp = new Date(record.metadata.timestamp);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should default confidence to 0.5', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Test' },
      [],
      { session_id: 'sess-123', source: 'user_prompt' }
    );

    expect(record.metadata.confidence).toBe(0.5);
  });

  it('should use provided confidence', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Test' },
      [],
      { session_id: 'sess-123', source: 'user_prompt', confidence: 0.9 }
    );

    expect(record.metadata.confidence).toBe(0.9);
  });

  it('should default category to general', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Test' },
      [],
      { session_id: 'sess-123', source: 'user_prompt' }
    );

    expect(record.metadata.category).toBe('general');
  });

  it('should use provided category', () => {
    const record = createDecisionRecord(
      'decision',
      { what: 'Test' },
      [],
      { session_id: 'sess-123', source: 'user_prompt', category: 'database' }
    );

    expect(record.metadata.category).toBe('database');
  });

  it('should determine generalizability based on confidence and patterns', () => {
    // High confidence with rationale and general pattern -> generalizable
    const generalizable = createDecisionRecord(
      'decision',
      { what: 'Use cursor pagination', why: 'Better performance at scale' },
      ['pagination', 'PostgreSQL'],
      { session_id: 'sess-123', source: 'user_prompt', confidence: 0.9 }
    );

    expect(generalizable.metadata.is_generalizable).toBe(true);
    expect(generalizable.metadata.sharing_scope).toBe('global');
  });

  it('should not be generalizable without rationale', () => {
    const notGeneralizable = createDecisionRecord(
      'decision',
      { what: 'Use cursor pagination' },
      ['pagination'],
      { session_id: 'sess-123', source: 'user_prompt', confidence: 0.9 }
    );

    expect(notGeneralizable.metadata.is_generalizable).toBe(false);
    expect(notGeneralizable.metadata.sharing_scope).toBe('team');
  });

  it('should not be generalizable with low confidence', () => {
    const notGeneralizable = createDecisionRecord(
      'decision',
      { what: 'Use cursor pagination', why: 'Better performance' },
      ['pagination'],
      { session_id: 'sess-123', source: 'user_prompt', confidence: 0.5 }
    );

    expect(notGeneralizable.metadata.is_generalizable).toBe(false);
  });
});

// =============================================================================
// isMem0Configured() Tests
// =============================================================================

describe('isMem0Configured', () => {
  const originalEnv = process.env.MEM0_API_KEY;

  afterEach(() => {
    if (originalEnv) {
      process.env.MEM0_API_KEY = originalEnv;
    } else {
      delete process.env.MEM0_API_KEY;
    }
  });

  it('should return true when MEM0_API_KEY is set', () => {
    process.env.MEM0_API_KEY = 'test-key';
    expect(isMem0Configured()).toBe(true);
  });

  it('should return false when MEM0_API_KEY is not set', () => {
    delete process.env.MEM0_API_KEY;
    expect(isMem0Configured()).toBe(false);
  });

  it('should return false when MEM0_API_KEY is empty', () => {
    process.env.MEM0_API_KEY = '';
    expect(isMem0Configured()).toBe(false);
  });
});

// =============================================================================
// queueGraphOperation() Tests
// =============================================================================

describe('queueGraphOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should queue operation to JSONL file', async () => {
    const fs = await import('node:fs');
    const mockAppendFileSync = vi.mocked(fs.appendFileSync);

    const operation: QueuedGraphOperation = {
      type: 'create_entities',
      payload: {
        entities: [{ name: 'Test', entityType: 'Technology', observations: [] }],
      },
      timestamp: new Date().toISOString(),
    };

    const result = queueGraphOperation(operation);

    expect(result).toBe(true);
    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('edge cases', () => {
  it('should handle empty entities array', () => {
    const decision = createMockDecision({ entities: [] });
    const operations = buildGraphOperations(decision);

    expect(operations.length).toBeGreaterThanOrEqual(1);
    const entities = getEntities(operations);
    // Should still have main entity
    expect(entities.length).toBe(1);
  });

  it('should handle empty content', () => {
    const decision = createMockDecision({
      content: { what: '' },
    });
    const operations = buildGraphOperations(decision);

    expect(operations).toBeDefined();
    expect(operations.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle special characters in entity names', () => {
    const decision = createMockDecision({
      entities: ['PostgreSQL-15', 'Node.js', 'C++', '@prisma/client'],
    });
    const operations = buildGraphOperations(decision);

    const entities = getEntities(operations);
    expect(entities.some(e => e.name === 'PostgreSQL-15')).toBe(true);
    expect(entities.some(e => e.name === 'Node.js')).toBe(true);
    expect(entities.some(e => e.name === 'C++')).toBe(true);
    expect(entities.some(e => e.name === '@prisma/client')).toBe(true);
  });

  it('should handle very long what content', () => {
    const longWhat = 'A'.repeat(500);
    const decision = createMockDecision({
      content: { what: longWhat },
    });
    const operations = buildGraphOperations(decision);

    const entities = getEntities(operations);
    const mainEntity = entities.find(e => e.name === decision.id);
    // Observations should include the full what
    expect(mainEntity?.observations.some(o => o.includes(longWhat))).toBe(true);
  });

  it('should handle unicode in entity names', () => {
    const decision = createMockDecision({
      entities: ['日本語', 'über', '中文', 'emoji🔥'],
    });
    const operations = buildGraphOperations(decision);

    const entities = getEntities(operations);
    expect(entities.some(e => e.name === '日本語')).toBe(true);
    expect(entities.some(e => e.name === 'emoji🔥')).toBe(true);
  });

  it('should handle duplicate entities', () => {
    const decision = createMockDecision({
      entities: ['PostgreSQL', 'PostgreSQL', 'Redis', 'Redis'],
    });
    const operations = buildGraphOperations(decision);

    // Should create entities for all (deduplication is caller's responsibility)
    const entities = getEntities(operations);
    const postgresCount = entities.filter(e => e.name === 'PostgreSQL').length;
    expect(postgresCount).toBe(2);
  });
});

// =============================================================================
// Integration Scenarios
// =============================================================================

describe('integration scenarios', () => {
  it('should handle complete database decision flow', () => {
    const decision = createMockDecision({
      type: 'decision',
      content: {
        what: 'Use PostgreSQL with cursor pagination',
        why: 'Better performance for large datasets, consistent ordering',
        alternatives: ['Offset pagination', 'Keyset without cursor'],
        constraints: ['Must support bidirectional navigation', 'Millions of rows'],
        tradeoffs: ['More complex implementation', 'Cannot jump to page N'],
      },
      entities: ['PostgreSQL', 'cursor-pagination', 'keyset-pagination'],
      metadata: {
        session_id: 'sess-123',
        timestamp: new Date().toISOString(),
        confidence: 0.95,
        source: 'user_prompt',
        project: 'api-service',
        category: 'database',
        importance: 'high',
      },
    });

    const operations = buildGraphOperations(decision);

    // Verify entity creation
    const entities = getEntities(operations);
    expect(entities.length).toBe(4); // main + 3 entities

    // Verify CHOSE relations
    expect(hasRelation(operations, decision.id, 'PostgreSQL', 'CHOSE')).toBe(true);
    expect(hasRelation(operations, decision.id, 'cursor-pagination', 'CHOSE')).toBe(true);

    // Verify CHOSE_OVER relations
    expect(hasRelation(operations, 'Use PostgreSQL with cursor pagination', 'Offset pagination', 'CHOSE_OVER')).toBe(true);

    // Verify RELATES_TO cross-links
    expect(countRelations(operations, 'RELATES_TO')).toBe(3); // 3 entities = 3 cross-links

    // Verify CONSTRAINT and TRADEOFF
    expect(countRelations(operations, 'CONSTRAINT')).toBe(2);
    expect(countRelations(operations, 'TRADEOFF')).toBe(2);
  });

  it('should handle preference storage flow', () => {
    const decision = createMockDecision({
      type: 'preference',
      content: {
        what: 'Prefer strict TypeScript with no implicit any',
        why: 'Catches bugs earlier, better IDE support',
      },
      entities: ['TypeScript', 'strict-mode', 'type-safety'],
    });

    const operations = buildGraphOperations(decision);

    // Preferences should use PREFERS relation
    expect(hasRelation(operations, decision.id, 'TypeScript', 'PREFERS')).toBe(true);
    expect(hasRelation(operations, decision.id, 'strict-mode', 'PREFERS')).toBe(true);
  });

  it('should handle problem-solution storage flow', () => {
    const decision = createMockDecision({
      type: 'problem-solution',
      content: {
        what: 'Solved N+1 query problem with DataLoader',
        why: 'Batches queries automatically, reduces database load',
      },
      entities: ['N+1-problem', 'DataLoader', 'GraphQL', 'batching'],
    });

    const operations = buildGraphOperations(decision);

    const mainEntity = getEntities(operations).find(e => e.name === decision.id);
    expect(mainEntity?.entityType).toBe('Solution');

    // MENTIONS for problem-solution type
    expect(hasRelation(operations, decision.id, 'N+1-problem', 'MENTIONS')).toBe(true);
    expect(hasRelation(operations, decision.id, 'DataLoader', 'MENTIONS')).toBe(true);
  });
});

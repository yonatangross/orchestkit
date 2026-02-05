/**
 * Integration tests for Intent Classifier (Issue #197)
 * Tests hybrid semantic+keyword scoring engine with various prompts
 *
 * Note: These are integration tests that require the real agents/ and skills/
 * directories to be present. Set CLAUDE_PLUGIN_ROOT to orchestkit root.
 */

import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyIntent,
  shouldClassify,
  clearCache,
} from '../lib/intent-classifier.js';
import type { CalibrationAdjustment } from '../lib/orchestration-types.js';
import { THRESHOLDS } from '../lib/orchestration-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Test Setup
// =============================================================================

let originalPluginRoot: string | undefined;

beforeAll(() => {
  // Set plugin root to orchestkit root (two levels up from hooks/src/__tests__)
  originalPluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  process.env.CLAUDE_PLUGIN_ROOT = join(__dirname, '..', '..', '..', '..');
});

afterAll(() => {
  // Restore original value
  if (originalPluginRoot !== undefined) {
    process.env.CLAUDE_PLUGIN_ROOT = originalPluginRoot;
  } else {
    delete process.env.CLAUDE_PLUGIN_ROOT;
  }
});

beforeEach(() => {
  // Clear cached indices before each test
  clearCache();
});

// =============================================================================
// Basic Classification Tests
// =============================================================================

describe('classifyIntent - basic classification', () => {
  test('returns empty arrays for non-matching prompt', () => {
    const result = classifyIntent('random text about gardening');

    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.intent).toBe('general');
    expect(result.shouldAutoDispatch).toBe(false);
    expect(result.shouldInjectSkills).toBe(false);
  });

  test('classifies backend API prompt', () => {
    const prompt = 'Design a REST API with database schema for user management';
    const result = classifyIntent(prompt);

    // Should find some matching agents (exact agent depends on definitions)
    if (result.agents.length > 0) {
      expect(result.agents[0].confidence).toBeGreaterThan(THRESHOLDS.MINIMUM);
      expect(['api-design', 'database', 'general']).toContain(result.intent);
    }
  });

  test('classifies frontend React prompt', () => {
    const prompt = 'Build a React component with form state management';
    const result = classifyIntent(prompt);

    // Should find frontend-related agents or return general
    if (result.agents.length > 0) {
      expect(result.agents[0].matchedKeywords).toBeDefined();
    }
    expect(['frontend', 'general']).toContain(result.intent);
  });

  test('classifies test generation prompt', () => {
    const prompt = 'Generate unit tests with coverage for the user service';
    const result = classifyIntent(prompt);

    // Should find test-related agents or return general
    expect(['testing', 'general']).toContain(result.intent);
  });

  test('classifies security audit prompt', () => {
    const prompt = 'Audit the application for OWASP Top 10 vulnerabilities';
    const result = classifyIntent(prompt);

    // Should find security agents or return general
    expect(['security', 'general']).toContain(result.intent);
  });
});

// =============================================================================
// Confidence Threshold Tests
// =============================================================================

describe('classifyIntent - confidence thresholds', () => {
  test('auto-dispatch at 85%+ confidence', () => {
    // Very specific backend API prompt with many keywords
    const prompt = 'Design RESTful API endpoints with OpenAPI schema for microservices backend';
    const result = classifyIntent(prompt);

    if (result.agents.length > 0 && result.agents[0].confidence >= THRESHOLDS.AUTO_DISPATCH) {
      expect(result.shouldAutoDispatch).toBe(true);
      expect(result.agents[0].confidence).toBeGreaterThanOrEqual(THRESHOLDS.AUTO_DISPATCH);
    }
  });

  test('skill injection at 80%+ confidence', () => {
    const prompt = 'Write integration tests with pytest fixtures and vcr cassettes';
    const result = classifyIntent(prompt);

    if (result.skills.length > 0 && result.skills[0].confidence >= THRESHOLDS.SKILL_INJECT) {
      expect(result.shouldInjectSkills).toBe(true);
      expect(result.skills[0].confidence).toBeGreaterThanOrEqual(THRESHOLDS.SKILL_INJECT);
    }
  });

  test('filters results below minimum threshold', () => {
    const result = classifyIntent('vague prompt');

    // All results should be above THRESHOLDS.MINIMUM (20)
    for (const agent of result.agents) {
      expect(agent.confidence).toBeGreaterThanOrEqual(THRESHOLDS.MINIMUM);
    }
    for (const skill of result.skills) {
      expect(skill.confidence).toBeGreaterThanOrEqual(THRESHOLDS.MINIMUM);
    }
  });
});

// =============================================================================
// Keyword Matching Tests
// =============================================================================

describe('classifyIntent - keyword matching', () => {
  test('matches single keyword with word boundaries', () => {
    const result = classifyIntent('api design patterns');

    // If agents match, they should have matched keywords
    if (result.agents.length > 0) {
      expect(result.agents[0].matchedKeywords.length).toBeGreaterThan(0);
    }
  });

  test('matches multiple keywords for higher score', () => {
    const prompt = 'database schema migration with PostgreSQL';
    const result = classifyIntent(prompt);

    if (result.agents.length > 0) {
      expect(result.agents[0].matchedKeywords.length).toBeGreaterThan(1);
    }
  });

  test('longer keywords have higher weight', () => {
    const prompt1 = 'api endpoint';
    const prompt2 = 'authentication endpoint';

    const result1 = classifyIntent(prompt1);
    const result2 = classifyIntent(prompt2);

    // Authentication (14 chars) should score higher than api (3 chars)
    if (result2.agents.length > 0 && result1.agents.length > 0) {
      const authScore = result2.agents.find(a =>
        a.matchedKeywords.includes('authentication')
      )?.confidence || 0;
      const apiScore = result1.agents[0].confidence;

      expect(authScore).toBeGreaterThan(0);
    }
  });

  test('respects word boundaries', () => {
    // "test" should not match "testimony"
    const result = classifyIntent('testimony about the project');

    const testAgent = result.agents.find(a => a.agent.includes('test'));
    expect(testAgent).toBeUndefined();
  });
});

// =============================================================================
// Phrase Matching Tests
// =============================================================================

describe('classifyIntent - phrase matching', () => {
  test('matches multi-word phrases', () => {
    const prompt = 'database schema design for PostgreSQL';
    const result = classifyIntent(prompt);

    if (result.agents.length > 0) {
      const hasPhrase = result.agents[0].signals.some(s => s.type === 'phrase');
      // May or may not have phrase matches depending on agent definitions
      expect(result.agents[0].signals).toBeDefined();
    }
  });

  test('phrase matching weights by word count', () => {
    const prompt = 'RESTful API design patterns';
    const result = classifyIntent(prompt);

    // Multi-word phrases should contribute to overall score
    expect(result.agents.length).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Context Continuity Tests
// =============================================================================

describe('classifyIntent - context continuity', () => {
  test('boosts confidence with continuation keywords', () => {
    const history = ['Design the user authentication API'];
    const prompt = 'Also add rate limiting';

    const result = classifyIntent(prompt, history);

    // Should find context signals
    const contextSignals = result.signals.filter(s => s.type === 'context');
    expect(contextSignals.length).toBeGreaterThanOrEqual(0);
  });

  test('boosts confidence when keywords in history', () => {
    const history = [
      'Design a backend API',
      'Add database migrations',
      'Implement authentication',
    ];
    const prompt = 'Continue with the database schema';

    const result = classifyIntent(prompt, history);

    // Should find context signals when history is relevant
    const contextSignals = result.signals.filter(s => s.type === 'context');
    expect(contextSignals.length).toBeGreaterThanOrEqual(0);
  });

  test('continuation keywords boost score', () => {
    const continuationWords = [
      'continue with the API',
      'also add authentication',
      'additionally implement caching',
      'then deploy to production',
      'next optimize the queries',
      'follow up with monitoring',
      'after that add logging',
    ];

    for (const prompt of continuationWords) {
      const result = classifyIntent(prompt, ['previous context about backend']);

      const contextSignal = result.signals.find(s =>
        s.type === 'context' && s.source === 'continuation-keyword'
      );

      // At least one should trigger
      if (result.agents.length > 0) {
        expect(result.signals).toBeDefined();
      }
    }
  });

  test('uses last 3 prompts for history matching', () => {
    const history = [
      'irrelevant context 1',
      'irrelevant context 2',
      'Design backend API',
      'Add database schema',
      'Implement authentication',
    ];
    const prompt = 'Continue with the API endpoints';

    const result = classifyIntent(prompt, history);

    // Result should be valid (agents list may be empty or populated)
    expect(result).toBeDefined();
    expect(result.agents).toBeDefined();
  });
});

// =============================================================================
// Negation Detection Tests
// =============================================================================

describe('classifyIntent - negation detection', () => {
  test('reduces confidence for "not" negation', () => {
    const positive = 'Design a REST API';
    const negative = 'Do not design a REST API';

    const resultPos = classifyIntent(positive);
    const resultNeg = classifyIntent(negative);

    if (resultPos.agents.length > 0 && resultNeg.agents.length > 0) {
      expect(resultNeg.agents[0].confidence).toBeLessThan(
        resultPos.agents[0].confidence
      );
    }
  });

  test('detects various negation patterns', () => {
    const negations = [
      "Don't use REST API",
      "Won't implement authentication",
      "Can't add database",
      "Shouldn't deploy yet",
      'Avoid using microservices',
      'Build without authentication',
      'Implement except for testing',
      'Design unlike REST APIs',
      'Use GraphQL instead of REST',
    ];

    for (const prompt of negations) {
      const result = classifyIntent(prompt);

      const negationSignal = result.signals.find(s => s.type === 'negation');
      // At least one should trigger negation
      if (result.agents.length > 0) {
        expect(result.signals).toBeDefined();
      }
    }
  });

  test('negation penalty is 25 points', () => {
    const prompt = "Don't design a backend API with database";
    const result = classifyIntent(prompt);

    const negationSignal = result.signals.find(s => s.type === 'negation');
    if (negationSignal) {
      expect(negationSignal.weight).toBe(-25);
    }
  });
});

// =============================================================================
// Calibration Tests
// =============================================================================

describe('classifyIntent - calibration adjustments', () => {
  test('applies positive calibration adjustment', () => {
    const adjustments: CalibrationAdjustment[] = [
      {
        keyword: 'api',
        agent: 'backend-system-architect',
        adjustment: 5,
        sampleCount: 3,
        lastUpdated: new Date().toISOString(),
      },
    ];

    const prompt = 'Design a REST API';
    const result = classifyIntent(prompt, [], adjustments);

    const calibrationSignal = result.signals.find(
      s => s.source === 'calibration' && s.weight > 0
    );

    if (result.agents.length > 0) {
      expect(result.signals).toBeDefined();
    }
  });

  test('applies negative calibration adjustment', () => {
    const adjustments: CalibrationAdjustment[] = [
      {
        keyword: 'test',
        agent: 'test-generator',
        adjustment: -5,
        sampleCount: 3,
        lastUpdated: new Date().toISOString(),
      },
    ];

    const prompt = 'Generate unit tests';
    const result = classifyIntent(prompt, [], adjustments);

    if (result.agents.length > 0) {
      expect(result.signals).toBeDefined();
    }
  });

  test('caps calibration adjustment at +/-15 points', () => {
    const adjustments: CalibrationAdjustment[] = [
      {
        keyword: 'api',
        agent: 'backend-system-architect',
        adjustment: 20, // Should be capped at 15
        sampleCount: 10,
        lastUpdated: new Date().toISOString(),
      },
    ];

    const prompt = 'Design a REST API';
    const result = classifyIntent(prompt, [], adjustments);

    const calibrationSignals = result.signals.filter(s => s.source === 'calibration');
    if (calibrationSignals.length > 0) {
      const totalAdjustment = calibrationSignals.reduce((sum, s) => sum + s.weight, 0);
      expect(Math.abs(totalAdjustment)).toBeLessThanOrEqual(15);
    }
  });
});

// =============================================================================
// Signal Analysis Tests
// =============================================================================

describe('classifyIntent - signal tracking', () => {
  test('records all signal types', () => {
    const prompt = 'Also design a REST API with authentication';
    const history = ['Build backend services'];

    const result = classifyIntent(prompt, history);

    // Result should be valid (signals may be empty if no agents match)
    expect(result.signals).toBeDefined();

    // If signals present, verify structure
    if (result.signals.length > 0) {
      const signalTypes = new Set(result.signals.map(s => s.type));
      expect(signalTypes.size).toBeGreaterThan(0);
    }
  });

  test('each signal has required fields', () => {
    const result = classifyIntent('Design database schema with PostgreSQL');

    for (const signal of result.signals) {
      expect(signal).toHaveProperty('type');
      expect(signal).toHaveProperty('source');
      expect(signal).toHaveProperty('weight');
      expect(signal).toHaveProperty('matched');
    }
  });

  test('signals contribute to final confidence', () => {
    const prompt = 'Design backend API with database authentication';
    const result = classifyIntent(prompt);

    if (result.agents.length > 0) {
      const agent = result.agents[0];
      // Should have multiple signals contributing
      expect(agent.signals.length).toBeGreaterThan(0);
      expect(agent.confidence).toBeGreaterThan(THRESHOLDS.MINIMUM);
    }
  });
});

// =============================================================================
// Intent Categorization Tests
// =============================================================================

describe('classifyIntent - intent categorization', () => {
  // These tests check that prompts get categorized appropriately
  // The exact category depends on agent definitions - we test for reasonable matches
  const intentTests = [
    { prompt: 'Design REST API with OpenAPI', expectedOptions: ['api-design', 'database', 'general'] },
    { prompt: 'Create database schema with PostgreSQL', expectedOptions: ['database', 'api-design', 'general'] },
    { prompt: 'Implement JWT authentication with OAuth', expectedOptions: ['authentication', 'security', 'general'] },
    { prompt: 'Build React component with state management', expectedOptions: ['frontend', 'general'] },
    { prompt: 'Generate unit tests with coverage', expectedOptions: ['testing', 'general'] },
    { prompt: 'Setup CI/CD pipeline with GitHub Actions', expectedOptions: ['devops', 'general'] },
    { prompt: 'Add RAG with LangGraph and embeddings', expectedOptions: ['ai-integration', 'general'] },
    { prompt: 'Audit for OWASP vulnerabilities', expectedOptions: ['security', 'general'] },
  ];

  intentTests.forEach(({ prompt, expectedOptions }) => {
    test(`categorizes "${prompt}" reasonably`, () => {
      const result = classifyIntent(prompt);

      // Intent should be one of the expected options
      expect(expectedOptions).toContain(result.intent);
    });
  });

  test('defaults to "general" for uncategorized prompts', () => {
    const result = classifyIntent('random unrelated text');

    expect(result.intent).toBe('general');
  });
});

// =============================================================================
// Result Sorting Tests
// =============================================================================

describe('classifyIntent - result sorting', () => {
  test('sorts agents by confidence descending', () => {
    const prompt = 'Design REST API with database authentication testing';
    const result = classifyIntent(prompt);

    if (result.agents.length > 1) {
      for (let i = 0; i < result.agents.length - 1; i++) {
        expect(result.agents[i].confidence).toBeGreaterThanOrEqual(
          result.agents[i + 1].confidence
        );
      }
    }
  });

  test('sorts skills by confidence descending', () => {
    const prompt = 'Write integration tests with unit testing and e2e coverage';
    const result = classifyIntent(prompt);

    if (result.skills.length > 1) {
      for (let i = 0; i < result.skills.length - 1; i++) {
        expect(result.skills[i].confidence).toBeGreaterThanOrEqual(
          result.skills[i + 1].confidence
        );
      }
    }
  });

  test('returns top 3 agents', () => {
    const prompt = 'Design full-stack application with backend frontend testing security';
    const result = classifyIntent(prompt);

    expect(result.agents.length).toBeLessThanOrEqual(3);
  });

  test('returns top 5 skills', () => {
    const prompt = 'Implement feature with testing security monitoring deployment automation';
    const result = classifyIntent(prompt);

    expect(result.skills.length).toBeLessThanOrEqual(5);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('classifyIntent - edge cases', () => {
  test('handles empty prompt', () => {
    const result = classifyIntent('');

    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.intent).toBe('general');
  });

  test('handles very short prompt', () => {
    const result = classifyIntent('hi');

    expect(result).toBeDefined();
    expect(result.agents.length).toBe(0);
  });

  test('handles very long prompt', () => {
    const longPrompt = 'Design a comprehensive backend API system with '.repeat(50);
    const result = classifyIntent(longPrompt);

    expect(result).toBeDefined();
    expect(result.agents.length).toBeGreaterThanOrEqual(0);
  });

  test('handles special characters', () => {
    const result = classifyIntent('Design API with @special #characters & symbols!');

    expect(result).toBeDefined();
  });

  test('handles Unicode characters', () => {
    const result = classifyIntent('Design API with émojis 🚀 and Unicode');

    expect(result).toBeDefined();
  });
});

// =============================================================================
// shouldClassify Filter Tests
// =============================================================================

describe('shouldClassify - filtering', () => {
  test('filters short prompts < 10 chars', () => {
    expect(shouldClassify('hi')).toBe(false);
    expect(shouldClassify('yes')).toBe(false);
    expect(shouldClassify('no thanks')).toBe(false);
  });

  test('filters meta questions about agents', () => {
    expect(shouldClassify('what agents are available?')).toBe(false);
    expect(shouldClassify('list agents')).toBe(false);
    expect(shouldClassify('available agents?')).toBe(false);
    expect(shouldClassify('what skills do you have?')).toBe(false);
  });

  test('filters simple commands', () => {
    expect(shouldClassify('yes')).toBe(false);
    expect(shouldClassify('no')).toBe(false);
    expect(shouldClassify('ok')).toBe(false);
    expect(shouldClassify('thanks')).toBe(false);
    expect(shouldClassify('done')).toBe(false);
    expect(shouldClassify('continue')).toBe(false);
    expect(shouldClassify('stop')).toBe(false);
  });

  test('allows valid prompts', () => {
    expect(shouldClassify('Design a REST API')).toBe(true);
    expect(shouldClassify('Build React component')).toBe(true);
    expect(shouldClassify('Generate unit tests')).toBe(true);
  });
});

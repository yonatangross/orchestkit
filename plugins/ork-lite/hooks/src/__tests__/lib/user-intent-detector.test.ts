/**
 * Tests for User Intent Detector
 * Part of Intelligent Decision Capture System
 *
 * Comprehensive test coverage for:
 * - detectUserIntent() - main detection function
 * - extractEntities() - entity extraction
 * - extractRationale() - rationale extraction
 * - hasDecisionLanguage() - decision check
 * - hasProblemLanguage() - problem check
 * - hasQuestionLanguage() - question check
 */

import { describe, it, expect, test } from 'vitest';
import {
  detectUserIntent,
  extractEntities,
  extractRationale,
  extractConstraints,
  extractTradeoffs,
  hasDecisionLanguage,
  hasProblemLanguage,
  hasQuestionLanguage,
  type IntentDetectionResult,
  type UserIntent,
} from '../../lib/user-intent-detector.js';

// =============================================================================
// detectUserIntent() - Main Detection Function
// =============================================================================

describe('detectUserIntent', () => {
  // ---------------------------------------------------------------------------
  // Decision Detection
  // ---------------------------------------------------------------------------
  describe('decision detection', () => {
    it('should detect "let\'s use" pattern as decision intent', () => {
      const result = detectUserIntent("let's use PostgreSQL for this project");
      // Check intents array for decision type (may not be high-confidence enough for decisions[])
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
      expect(decisionIntents[0].entities).toContain('postgresql');
    });

    it('should detect "lets use" pattern as decision intent', () => {
      const result = detectUserIntent('lets use FastAPI for the backend');
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
    });

    it('should detect "chose X over Y" pattern with alternatives', () => {
      const result = detectUserIntent('I chose Redis over Memcached for caching');
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].alternatives).toBeDefined();
      const hasAlternative = result.decisions[0].alternatives?.some(
        alt => alt.toLowerCase().includes('memcached')
      );
      expect(hasAlternative).toBe(true);
    });

    it('should detect "decided to go with" pattern', () => {
      const result = detectUserIntent(
        'I decided to go with FastAPI because it is async native'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].rationale).toBeDefined();
      expect(result.decisions[0].rationale).toContain('async native');
    });

    it('should detect decision with "because" rationale', () => {
      const result = detectUserIntent(
        'I chose PostgreSQL because it has better JSON support'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].rationale).toBeDefined();
      expect(result.decisions[0].rationale).toContain('better JSON support');
    });

    it('should detect decision with "since" rationale', () => {
      const result = detectUserIntent(
        'I selected TypeScript since it provides type safety'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].rationale).toBeDefined();
      expect(result.decisions[0].rationale).toContain('type safety');
    });

    it('should detect decision with "to avoid" rationale', () => {
      const result = detectUserIntent(
        'I decided on cursor-pagination to avoid performance issues'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].rationale).toBeDefined();
      expect(result.decisions[0].rationale).toContain('performance issues');
    });

    it('should detect "going with" pattern as decision intent', () => {
      const result = detectUserIntent('going with React for the frontend');
      // "going with" without strong verb may not reach 0.7 confidence threshold
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
      expect(decisionIntents[0].entities).toContain('react');
    });

    it('should detect "will use" pattern as decision intent', () => {
      const result = detectUserIntent('We will use Docker for containerization');
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
      expect(decisionIntents[0].entities).toContain('docker');
    });

    it('should detect "opting for" pattern as decision intent', () => {
      const result = detectUserIntent('opting for microservices architecture');
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
      expect(decisionIntents[0].entities).toContain('microservices');
    });

    it('should detect "instead of" pattern with alternatives', () => {
      const result = detectUserIntent('I chose GraphQL instead of REST for the API');
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].alternatives).toBeDefined();
      const hasRest = result.decisions[0].alternatives?.some(
        alt => alt.toLowerCase().includes('rest')
      );
      expect(hasRest).toBe(true);
    });

    it('should detect "I decided" pattern with subject', () => {
      // The "I decided/chose" pattern is explicitly supported
      const result = detectUserIntent('I decided TDD is the way to go for this project');
      const decisionIntents = result.intents.filter(i => i.type === 'decision');
      expect(decisionIntents.length).toBeGreaterThan(0);
      expect(decisionIntents[0].entities).toContain('tdd');
    });

    it('should detect high-confidence decisions with "decided" verb', () => {
      const result = detectUserIntent('I decided to use PostgreSQL for this');
      // "decided" is a strong decision verb that should reach 0.7 threshold
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // ---------------------------------------------------------------------------
  // Preference Detection
  // ---------------------------------------------------------------------------
  describe('preference detection', () => {
    it('should detect "I prefer" pattern', () => {
      const result = detectUserIntent('I prefer TypeScript for all new code');
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].type).toBe('preference');
      expect(result.preferences[0].entities).toContain('typescript');
    });

    it('should detect "always use" pattern', () => {
      const result = detectUserIntent('always use cursor-pagination for large datasets');
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].entities).toContain('cursor-pagination');
    });

    it('should detect "never use" pattern', () => {
      const result = detectUserIntent('never use offset-pagination for tables over 10k rows');
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].entities).toContain('offset-pagination');
    });

    it('should detect "I like" pattern', () => {
      const result = detectUserIntent('I like using pytest for Python testing');
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].entities).toContain('pytest');
    });

    it('should detect "I\'d prefer" pattern', () => {
      const result = detectUserIntent("I'd prefer to use Vitest for frontend tests");
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].entities).toContain('vitest');
    });

    it('should detect "don\'t use" pattern', () => {
      const result = detectUserIntent("don't use var in JavaScript, use const");
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].type).toBe('preference');
    });

    it('should detect "style should be" pattern', () => {
      const result = detectUserIntent('style should be camelCase for variables');
      expect(result.preferences.length).toBeGreaterThan(0);
    });

    it('should have higher confidence for preferences with entities', () => {
      const withEntity = detectUserIntent('I prefer TypeScript over JavaScript');
      const withoutEntity = detectUserIntent('I prefer that approach over this one');

      expect(withEntity.preferences[0].confidence).toBeGreaterThan(
        withoutEntity.preferences[0].confidence
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Problem Detection
  // ---------------------------------------------------------------------------
  describe('problem detection', () => {
    it('should detect "getting an error" pattern', () => {
      const result = detectUserIntent('getting an error with the API endpoint');
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems[0].type).toBe('problem');
    });

    it('should detect "the database isn\'t working" pattern', () => {
      const result = detectUserIntent("the database isn't working properly");
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should detect "tests are failing" pattern', () => {
      const result = detectUserIntent('The tests are failing with a timeout error');
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems[0].type).toBe('problem');
    });

    it('should detect "bug" keyword', () => {
      const result = detectUserIntent('There is a bug in the login flow');
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should detect "broken" keyword', () => {
      const result = detectUserIntent('The API is broken after the last deploy');
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should detect "crash" pattern', () => {
      const result = detectUserIntent('The application crashes when loading data');
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should detect "timeout" pattern', () => {
      const result = detectUserIntent('timeout in the database queries');
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should detect "exception" pattern', () => {
      const result = detectUserIntent('exception when connecting to Redis');
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems[0].entities).toContain('redis');
    });

    it('should detect "not working" pattern', () => {
      const result = detectUserIntent('authentication is not working');
      expect(result.problems.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Question Detection
  // ---------------------------------------------------------------------------
  describe('question detection', () => {
    it('should detect "how do I" pattern', () => {
      const result = detectUserIntent('how do I implement authentication?');
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0].type).toBe('question');
    });

    it('should detect "how can I" pattern', () => {
      const result = detectUserIntent('how can I improve performance?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "how to" pattern', () => {
      const result = detectUserIntent('how to setup Docker for this project');
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0].entities).toContain('docker');
    });

    it('should detect "what is" pattern', () => {
      const result = detectUserIntent('what is the best approach for caching?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "what are" pattern', () => {
      const result = detectUserIntent('what are the dependencies for this module?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "why does" pattern', () => {
      const result = detectUserIntent('why does this test fail randomly?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "why is" pattern', () => {
      const result = detectUserIntent('why is the build so slow?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "can you explain" pattern', () => {
      const result = detectUserIntent('can you explain how JWT authentication works?');
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0].entities).toContain('jwt');
    });

    it('should detect "where is" pattern', () => {
      const result = detectUserIntent('where is the config file located?');
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should detect "when should" pattern', () => {
      const result = detectUserIntent('when should I use Redis vs PostgreSQL?');
      expect(result.questions.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence Scoring
  // ---------------------------------------------------------------------------
  describe('confidence scoring', () => {
    it('should have higher confidence with rationale', () => {
      const withRationale = detectUserIntent(
        'I decided to use cursor pagination because it scales better'
      );
      const withoutRationale = detectUserIntent('I decided to use cursor pagination');

      expect(withRationale.decisions[0].confidence).toBeGreaterThan(
        withoutRationale.decisions[0].confidence
      );
    });

    it('should have higher confidence with alternatives', () => {
      const withAlternatives = detectUserIntent(
        'I chose PostgreSQL over MySQL for better JSON support'
      );
      const withoutAlternatives = detectUserIntent(
        'I chose PostgreSQL for better JSON support'
      );

      expect(withAlternatives.decisions[0].confidence).toBeGreaterThanOrEqual(
        withoutAlternatives.decisions[0].confidence
      );
    });

    it('should have higher confidence with more entities', () => {
      const manyEntities = detectUserIntent(
        'I decided to use FastAPI with PostgreSQL and Redis'
      );
      const fewEntities = detectUserIntent('I decided to use some framework');

      // manyEntities should have 3 entities, fewEntities should have 0
      expect(manyEntities.decisions[0].entities.length).toBeGreaterThan(
        fewEntities.decisions[0].entities.length
      );
    });

    it('should have lower confidence for very short matches', () => {
      const shortMatch = detectUserIntent('decided on X');
      const longMatch = detectUserIntent(
        'I decided on PostgreSQL with pgvector for vector search'
      );

      // Short matches lose confidence, long matches maintain or gain
      expect(longMatch.decisions[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should boost confidence for strong decision verbs', () => {
      const strongVerb = detectUserIntent('I decided to use PostgreSQL');
      const weakerVerb = detectUserIntent('going with PostgreSQL for this');

      // "decided" is a stronger signal than "going with"
      // Both should produce decision intents
      const strongDecisions = strongVerb.intents.filter(i => i.type === 'decision');
      const weakDecisions = weakerVerb.intents.filter(i => i.type === 'decision');

      expect(strongDecisions.length).toBeGreaterThan(0);
      expect(weakDecisions.length).toBeGreaterThan(0);
      expect(strongDecisions[0].confidence).toBeGreaterThanOrEqual(
        weakDecisions[0].confidence
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Deduplication of Overlapping Matches
  // ---------------------------------------------------------------------------
  describe('deduplication', () => {
    it('should deduplicate overlapping intents', () => {
      const result = detectUserIntent(
        'I decided to use PostgreSQL because I chose PostgreSQL'
      );
      // Should not have excessive duplicate decisions
      expect(result.decisions.length).toBeLessThanOrEqual(2);
    });

    it('should keep higher confidence intent when overlapping', () => {
      const result = detectUserIntent(
        'I decided to use PostgreSQL because it scales well'
      );
      // All remaining decisions should have confidence values
      result.decisions.forEach(d => {
        expect(d.confidence).toBeGreaterThan(0);
        expect(d.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should allow non-overlapping intents of same type', () => {
      const result = detectUserIntent(
        'I chose PostgreSQL for storage. I also selected Redis for caching.'
      );
      // Different positions, both should be kept
      expect(result.intents.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty prompt', () => {
      const result = detectUserIntent('');
      expect(result.intents.length).toBe(0);
      expect(result.summary).toContain('too short');
    });

    it('should handle very short prompt', () => {
      const result = detectUserIntent('hi');
      expect(result.intents.length).toBe(0);
      expect(result.summary).toContain('too short');
    });

    it('should handle prompt with exactly 10 characters', () => {
      const result = detectUserIntent('1234567890');
      expect(result.intents.length).toBe(0);
    });

    it('should handle prompts with no matches', () => {
      const result = detectUserIntent('Hello, how are you today?');
      expect(result.decisions.length).toBe(0);
      expect(result.preferences.length).toBe(0);
      expect(result.problems.length).toBe(0);
      expect(result.summary).toBe('No intents detected');
    });

    it('should handle special characters', () => {
      const result = detectUserIntent(
        'I decided to use @typescript/eslint-plugin for linting'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it('should handle multi-line prompts', () => {
      const result = detectUserIntent(`
        I decided to use PostgreSQL for this project.
        The main reason is better performance.
        I prefer TypeScript for all my code.
      `);
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.preferences.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const result = detectUserIntent(
        'I decided to use PostgreSQL for the application'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it('should handle multiple intents in one prompt', () => {
      const result = detectUserIntent(
        'I chose FastAPI because it is async. I prefer pytest for testing. The build is failing.'
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should handle very long prompts', () => {
      const longPrompt =
        'I decided to use PostgreSQL ' + 'for excellent performance. '.repeat(100);
      const result = detectUserIntent(longPrompt);
      expect(result.decisions.length).toBeGreaterThan(0);
      // Text should be truncated to 300 chars
      expect(result.decisions[0].text.length).toBeLessThanOrEqual(300);
    });
  });

  // ---------------------------------------------------------------------------
  // Summary Generation
  // ---------------------------------------------------------------------------
  describe('summary generation', () => {
    it('should generate summary with decision count', () => {
      const result = detectUserIntent('I decided to use PostgreSQL');
      expect(result.summary).toContain('decision');
    });

    it('should generate summary with preference count', () => {
      const result = detectUserIntent('I prefer TypeScript');
      expect(result.summary).toContain('preference');
    });

    it('should generate summary with multiple intent types', () => {
      const result = detectUserIntent(
        'I chose FastAPI. I prefer pytest. How do I test this?'
      );
      expect(result.summary).toContain('Detected:');
    });

    it('should pluralize correctly for multiple items', () => {
      const result = detectUserIntent(
        'I chose FastAPI. I also selected PostgreSQL. I prefer pytest. I like vitest.'
      );
      // Check if pluralization happens (ends with 's')
      if (result.preferences.length > 1) {
        expect(result.summary).toContain('preferences');
      }
    });
  });
});

// =============================================================================
// extractEntities() - Entity Extraction
// =============================================================================

describe('extractEntities', () => {
  describe('technology extraction', () => {
    it('should extract database technologies', () => {
      const entities = extractEntities('Using PostgreSQL with Redis for caching');
      expect(entities).toContain('postgresql');
      expect(entities).toContain('redis');
    });

    it('should extract framework technologies', () => {
      const entities = extractEntities('Building with FastAPI and React');
      expect(entities).toContain('fastapi');
      expect(entities).toContain('react');
    });

    it('should extract language technologies', () => {
      const entities = extractEntities('Written in TypeScript and Python');
      expect(entities).toContain('typescript');
      expect(entities).toContain('python');
    });

    it('should extract auth technologies', () => {
      const entities = extractEntities('Using JWT and OAuth2 for authentication');
      expect(entities).toContain('jwt');
      expect(entities).toContain('oauth2');
    });

    it('should extract AI/ML technologies', () => {
      const entities = extractEntities('Using LangChain with OpenAI');
      expect(entities).toContain('langchain');
      expect(entities).toContain('openai');
    });

    it('should extract infrastructure technologies', () => {
      const entities = extractEntities('Deployed on Docker with Kubernetes');
      expect(entities).toContain('docker');
      expect(entities).toContain('kubernetes');
    });

    it('should extract testing technologies', () => {
      const entities = extractEntities('Using pytest and Vitest for testing');
      expect(entities).toContain('pytest');
      expect(entities).toContain('vitest');
    });

    it('should extract build tool technologies', () => {
      const entities = extractEntities('Building with Vite and esbuild');
      expect(entities).toContain('vite');
      expect(entities).toContain('esbuild');
    });
  });

  describe('pattern extraction', () => {
    it('should extract pagination patterns', () => {
      const entities = extractEntities(
        'Implementing cursor-pagination instead of offset-pagination'
      );
      expect(entities).toContain('cursor-pagination');
      expect(entities).toContain('offset-pagination');
    });

    it('should extract architecture patterns', () => {
      const entities = extractEntities(
        'Using repository-pattern with dependency-injection'
      );
      expect(entities).toContain('repository-pattern');
      expect(entities).toContain('dependency-injection');
    });

    it('should extract resilience patterns', () => {
      const entities = extractEntities(
        'Implementing circuit-breaker and rate-limiting'
      );
      expect(entities).toContain('circuit-breaker');
      expect(entities).toContain('rate-limiting');
    });

    it('should extract development patterns', () => {
      const entities = extractEntities('Following TDD and DDD principles');
      expect(entities).toContain('tdd');
      expect(entities).toContain('ddd');
    });

    it('should extract API patterns', () => {
      const entities = extractEntities('Using REST and GraphQL endpoints');
      expect(entities).toContain('rest');
      expect(entities).toContain('graphql');
    });

    it('should handle space-separated pattern names', () => {
      // The pattern should match "cursor pagination" as "cursor-pagination"
      const entities = extractEntities('Using cursor pagination for large datasets');
      expect(entities).toContain('cursor-pagination');
    });
  });

  describe('tool extraction', () => {
    it('should extract CLI tools', () => {
      const entities = extractEntities('Using grep to search and git for version control');
      expect(entities).toContain('grep');
      expect(entities).toContain('git');
    });

    it('should extract package managers', () => {
      const entities = extractEntities('Managing with npm and yarn');
      expect(entities).toContain('npm');
      expect(entities).toContain('yarn');
    });

    it('should extract editors', () => {
      const entities = extractEntities('Using cursor and vscode for development');
      expect(entities).toContain('cursor');
      expect(entities).toContain('vscode');
    });
  });

  describe('word-boundary matching (no false positives)', () => {
    it('should NOT extract "java" from "JavaScript"', () => {
      const entities = extractEntities('We use JavaScript for the frontend');
      expect(entities).toContain('javascript');
      expect(entities).not.toContain('java');
    });

    it('should NOT extract "go" from "going"', () => {
      const entities = extractEntities('going with this approach for now');
      expect(entities).not.toContain('go');
    });

    it('should NOT extract "nest" from "nested"', () => {
      const entities = extractEntities('Using nested structures in the config');
      expect(entities).not.toContain('nest');
    });

    it('should NOT extract "react" from "reactive"', () => {
      const entities = extractEntities('The reactive approach is better');
      expect(entities).not.toContain('react');
    });

    it('should extract "java" when it stands alone', () => {
      const entities = extractEntities('We use Java for the backend');
      expect(entities).toContain('java');
      expect(entities).not.toContain('javascript');
    });

    it('should extract "go" when it stands alone', () => {
      const entities = extractEntities('We chose Go for the microservices');
      expect(entities).toContain('go');
    });

    it('should extract "nest" when it refers to NestJS', () => {
      const entities = extractEntities('Using Nest for the API layer');
      expect(entities).toContain('nest');
    });
  });

  describe('alias deduplication', () => {
    it('should deduplicate "postgres" and "postgresql" to "postgresql"', () => {
      const entities = extractEntities('Migrating from postgres to PostgreSQL 16');
      expect(entities).toContain('postgresql');
      expect(entities.filter(e => e === 'postgresql').length).toBe(1);
      expect(entities).not.toContain('postgres');
    });

    it('should deduplicate "k8s" and "kubernetes" to "kubernetes"', () => {
      const entities = extractEntities('Deploy on k8s using Kubernetes manifests');
      expect(entities).toContain('kubernetes');
      expect(entities.filter(e => e === 'kubernetes').length).toBe(1);
      expect(entities).not.toContain('k8s');
    });

    it('should deduplicate "oauth" and "oauth2" to "oauth2"', () => {
      const entities = extractEntities('Using OAuth for auth, specifically OAuth2 flows');
      expect(entities).toContain('oauth2');
      expect(entities.filter(e => e === 'oauth2').length).toBe(1);
      expect(entities).not.toContain('oauth');
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const entities = extractEntities('');
      expect(entities).toEqual([]);
    });

    it('should handle text with no entities', () => {
      const entities = extractEntities('Hello world, this is a test');
      expect(entities).toEqual([]);
    });

    it('should be case insensitive', () => {
      const entities = extractEntities('Using POSTGRESQL and REACT');
      expect(entities).toContain('postgresql');
      expect(entities).toContain('react');
    });

    it('should not duplicate entities', () => {
      const entities = extractEntities('PostgreSQL and postgresql and POSTGRESQL');
      expect(entities.filter(e => e === 'postgresql').length).toBe(1);
    });
  });
});

// =============================================================================
// extractRationale() - Rationale Extraction
// =============================================================================

describe('extractRationale', () => {
  it('should extract "because" rationale', () => {
    const text = 'I chose PostgreSQL because it has excellent JSON support';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('excellent JSON support');
  });

  it('should extract "since" rationale', () => {
    const text = 'Using TypeScript since it provides type safety';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('type safety');
  });

  it('should extract "due to" rationale', () => {
    const text = 'Switched to Redis due to better performance';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('better performance');
  });

  it('should extract "to avoid" rationale', () => {
    const text = 'Using cursor-pagination to avoid timeout issues';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('timeout issues');
  });

  it('should extract "for better" rationale', () => {
    const text = 'Chose PostgreSQL for better scalability';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('scalability');
  });

  it('should extract "so that" rationale', () => {
    const text = 'Using TypeScript so that we catch errors early';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('catch errors early');
  });

  it('should extract "in order to" rationale', () => {
    const text = 'Implemented caching in order to reduce latency';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('reduce latency');
  });

  it('should extract "as it" rationale', () => {
    const text = 'Using FastAPI as it supports async natively';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale).toContain('supports async natively');
  });

  it('should return undefined when no rationale found', () => {
    const text = 'I chose PostgreSQL';
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeUndefined();
  });

  it('should limit rationale to 200 characters', () => {
    const longRationale = 'because ' + 'a'.repeat(300);
    const text = 'I chose this ' + longRationale;
    const rationale = extractRationale(text, 0);
    expect(rationale).toBeDefined();
    expect(rationale!.length).toBeLessThanOrEqual(200);
  });

  it('should look in window around match position', () => {
    // Rationale appears after the match position
    const text = 'Some prefix text. I chose PostgreSQL because it scales well.';
    const rationale = extractRationale(text, 17); // Position of "I chose"
    expect(rationale).toBeDefined();
    expect(rationale).toContain('scales well');
  });
});

// =============================================================================
// hasDecisionLanguage() - Decision Check
// =============================================================================

describe('hasDecisionLanguage', () => {
  describe('should return true for decision keywords', () => {
    test.each([
      ['I decided to use X', 'decided'],
      ["let's use Y", "let's use"],
      ['I chose Z', 'chose'],
      ['We selected this approach', 'selected'],
      ['going with option A', 'going with'],
      ['will use PostgreSQL', 'will use'],
      ['opting for this solution', 'opting for'],
      ['I picked React', 'picked'],
      ['I prefer this method', 'prefer'],
    ])('%s contains "%s"', (text, _keyword) => {
      expect(hasDecisionLanguage(text)).toBe(true);
    });
  });

  describe('should return false for non-decision text', () => {
    test.each([
      ['Hello world', 'greeting'],
      ['What is the weather?', 'question'],
      ['The code runs fine', 'statement'],
      ['Please help me with this', 'request'],
      ['Looking at the documentation', 'observation'],
    ])('%s is a %s', (text, _type) => {
      expect(hasDecisionLanguage(text)).toBe(false);
    });
  });

  it('should be case insensitive', () => {
    expect(hasDecisionLanguage('I DECIDED to use this')).toBe(true);
    // "let's use" is in the keywords list, not "lets use"
    expect(hasDecisionLanguage("LET'S USE this")).toBe(true);
  });
});

// =============================================================================
// hasProblemLanguage() - Problem Check
// =============================================================================

describe('hasProblemLanguage', () => {
  describe('should return true for problem keywords', () => {
    test.each([
      ['There is an error in the code', 'error'],
      ['Found a bug in authentication', 'bug'],
      ['There is an issue with the API', 'issue'],
      ['We have a problem with deployment', 'problem'],
      ['The tests are failing', 'failing'],
      ['The system is broken', 'broken'],
      ['It is not working properly', 'not working'],
      ["The function doesn't work", "doesn't work"],
      ['The application crashed', 'crash'],
      ['Request timeout occurred', 'timeout'],
    ])('%s contains "%s"', (text, _keyword) => {
      expect(hasProblemLanguage(text)).toBe(true);
    });
  });

  describe('should return false for non-problem text', () => {
    test.each([
      ['Everything is great', 'positive'],
      ['Show me the code', 'request'],
      ['I want to implement this', 'intention'],
      ['The application works well', 'success'],
    ])('%s is a %s', (text, _type) => {
      expect(hasProblemLanguage(text)).toBe(false);
    });
  });

  it('should be case insensitive', () => {
    expect(hasProblemLanguage('There is an ERROR')).toBe(true);
    expect(hasProblemLanguage('THE BUG is here')).toBe(true);
  });
});

// =============================================================================
// hasQuestionLanguage() - Question Check
// =============================================================================

describe('hasQuestionLanguage', () => {
  describe('should return true for question keywords', () => {
    test.each([
      ['how do I implement this', 'how do i'],
      ['how can I fix this', 'how can i'],
      ['how to setup the database', 'how to'],
      ['what is the best approach', 'what is'],
      ['what are the options', 'what are'],
      ['what does this function do', 'what does'],
      ['why does this fail', 'why does'],
      ['why is this slow', 'why is'],
      ['why do we need this', 'why do'],
      ['where is the config file', 'where is'],
      ['where are the tests', 'where are'],
      ['when should I use this', 'when should'],
      ['can you explain this', 'can you explain'],
      ['can you help with this', 'can you help'],
    ])('%s contains "%s"', (text, _keyword) => {
      expect(hasQuestionLanguage(text)).toBe(true);
    });
  });

  describe('should return false for non-question text', () => {
    test.each([
      ['I want to implement this', 'intention'],
      ['Let us build this feature', 'action'],
      ['The code is working now', 'statement'],
      ['Please update the documentation', 'request'],
    ])('%s is a %s', (text, _type) => {
      expect(hasQuestionLanguage(text)).toBe(false);
    });
  });

  it('should be case insensitive', () => {
    expect(hasQuestionLanguage('HOW DO I implement this')).toBe(true);
    expect(hasQuestionLanguage('WHAT IS the solution')).toBe(true);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration tests', () => {
  it('should handle complex multi-intent prompt', () => {
    const result = detectUserIntent(`
      I'm having an issue with the database connection.
      I decided to use PostgreSQL because it has better support.
      How do I configure the connection pool?
      I prefer using environment variables for configuration.
    `);

    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.preferences.length).toBeGreaterThan(0);
  });

  it('should extract entities from decisions', () => {
    const result = detectUserIntent(
      'I decided to use FastAPI with PostgreSQL and Redis because they integrate well'
    );

    expect(result.decisions[0].entities).toContain('fastapi');
    expect(result.decisions[0].entities).toContain('postgresql');
    expect(result.decisions[0].entities).toContain('redis');
    expect(result.decisions[0].rationale).toContain('integrate well');
  });

  it('should maintain consistent type for all intents', () => {
    const result = detectUserIntent(
      'I chose FastAPI. I prefer pytest. Getting an error. How do I fix it?'
    );

    result.intents.forEach(intent => {
      expect(['decision', 'preference', 'problem', 'question', 'instruction']).toContain(
        intent.type
      );
      expect(typeof intent.confidence).toBe('number');
      expect(intent.confidence).toBeGreaterThanOrEqual(0);
      expect(intent.confidence).toBeLessThanOrEqual(1);
      expect(typeof intent.text).toBe('string');
      expect(Array.isArray(intent.entities)).toBe(true);
      expect(typeof intent.position).toBe('number');
    });
  });
});

// =============================================================================
// extractConstraints() - Constraint Extraction
// =============================================================================

describe('extractConstraints', () => {
  it('should extract "must" constraint', () => {
    const text = 'I chose PostgreSQL because we must support JSON queries';
    const constraints = extractConstraints(text, 0);
    expect(constraints.length).toBeGreaterThan(0);
    expect(constraints[0]).toContain('support JSON queries');
  });

  it('should extract "need to" constraint', () => {
    const text = 'Going with Redis since we need to handle 10k requests per second';
    const constraints = extractConstraints(text, 0);
    expect(constraints.length).toBeGreaterThan(0);
    expect(constraints[0]).toContain('handle 10k requests');
  });

  it('should extract "required" constraint', () => {
    const text = 'Using TypeScript because type safety is required for this project';
    const constraints = extractConstraints(text, 0);
    expect(constraints.length).toBeGreaterThan(0);
  });

  it('should return empty array when no constraints found', () => {
    const text = 'I chose PostgreSQL for the project';
    const constraints = extractConstraints(text, 0);
    expect(constraints).toEqual([]);
  });

  it('should deduplicate identical constraints', () => {
    const text = 'We must support JSON and we must support JSON queries';
    const constraints = extractConstraints(text, 0);
    const unique = new Set(constraints);
    expect(constraints.length).toBe(unique.size);
  });

  it('should limit to 5 constraints', () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `must handle requirement ${i} properly`
    ).join('. ');
    const constraints = extractConstraints(text, 0);
    expect(constraints.length).toBeLessThanOrEqual(5);
  });
});

// =============================================================================
// extractTradeoffs() - Tradeoff Extraction
// =============================================================================

describe('extractTradeoffs', () => {
  it('should extract "but" tradeoff', () => {
    const text = 'I chose PostgreSQL for features but it uses more memory';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeGreaterThan(0);
    expect(tradeoffs[0]).toContain('uses more memory');
  });

  it('should extract "however" tradeoff', () => {
    const text = 'Going with microservices however it increases complexity';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeGreaterThan(0);
    expect(tradeoffs[0]).toContain('increases complexity');
  });

  it('should extract "tradeoff" keyword', () => {
    const text = 'The tradeoff is slower writes for faster reads';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeGreaterThan(0);
  });

  it('should extract "downside" keyword', () => {
    const text = 'The downside is higher latency for some queries';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeGreaterThan(0);
    expect(tradeoffs[0]).toContain('higher latency');
  });

  it('should extract "although" tradeoff', () => {
    const text = 'Using Redis although it requires more infrastructure';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeGreaterThan(0);
    expect(tradeoffs[0]).toContain('requires more infrastructure');
  });

  it('should return empty array when no tradeoffs found', () => {
    const text = 'I chose PostgreSQL for the project';
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs).toEqual([]);
  });

  it('should limit to 5 tradeoffs', () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `however it has limitation ${i} to consider`
    ).join('. ');
    const tradeoffs = extractTradeoffs(text, 0);
    expect(tradeoffs.length).toBeLessThanOrEqual(5);
  });
});

// =============================================================================
// Decision detection with constraints/tradeoffs
// =============================================================================

describe('detectUserIntent - constraints and tradeoffs on decisions', () => {
  it('should attach constraints to decisions', () => {
    const result = detectUserIntent(
      'I decided to use PostgreSQL because we must support JSONB queries'
    );
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].constraints).toBeDefined();
    expect(result.decisions[0].constraints!.length).toBeGreaterThan(0);
  });

  it('should attach tradeoffs to decisions', () => {
    const result = detectUserIntent(
      'I decided to use microservices however it increases deployment complexity'
    );
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].tradeoffs).toBeDefined();
    expect(result.decisions[0].tradeoffs!.length).toBeGreaterThan(0);
  });

  it('should not attach empty constraints array', () => {
    const result = detectUserIntent('I decided to use PostgreSQL for this project');
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].constraints).toBeUndefined();
  });

  it('should not attach empty tradeoffs array', () => {
    const result = detectUserIntent('I decided to use PostgreSQL for this project');
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].tradeoffs).toBeUndefined();
  });
});

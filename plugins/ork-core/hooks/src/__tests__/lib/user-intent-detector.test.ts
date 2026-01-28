/**
 * Tests for User Intent Detector
 * Part of Intelligent Decision Capture System
 */

import { describe, it, expect } from 'vitest';
import {
  detectUserIntent,
  extractEntities,
  hasDecisionLanguage,
  hasProblemLanguage,
} from '../../lib/user-intent-detector.js';

describe('User Intent Detector', () => {
  describe('detectUserIntent', () => {
    it('should detect simple decision', () => {
      const result = detectUserIntent("I decided to use cursor-based pagination for this");
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].type).toBe('decision');
      expect(result.decisions[0].text.toLowerCase()).toContain('cursor');
    });

    it('should detect decision with rationale', () => {
      const result = detectUserIntent(
        "I chose PostgreSQL because it has better JSON support"
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0].rationale).toBeDefined();
      expect(result.decisions[0].rationale).toContain('better JSON support');
      expect(result.decisions[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect decision with alternatives', () => {
      const result = detectUserIntent(
        "I chose Redis over Memcached for caching"
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      // Alternatives may include trailing text
      expect(result.decisions[0].alternatives).toBeDefined();
      const hasMemcached = result.decisions[0].alternatives?.some(
        alt => alt.toLowerCase().includes('memcached')
      );
      expect(hasMemcached).toBe(true);
    });

    it('should detect preferences', () => {
      const result = detectUserIntent(
        "I prefer using TypeScript for all new code"
      );
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.preferences[0].type).toBe('preference');
    });

    it('should detect problems', () => {
      const result = detectUserIntent(
        "The tests are failing with a timeout error"
      );
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems[0].type).toBe('problem');
    });

    it('should handle prompts with no intents', () => {
      const result = detectUserIntent("Hello, how are you?");
      expect(result.decisions.length).toBe(0);
      expect(result.preferences.length).toBe(0);
      expect(result.problems.length).toBe(0);
    });

    it('should handle very short prompts', () => {
      const result = detectUserIntent("hi");
      expect(result.intents.length).toBe(0);
    });

    it('should detect multiple intents in one prompt', () => {
      const result = detectUserIntent(
        "I chose FastAPI because it's async. I prefer pytest for testing. The build is failing."
      );
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.preferences.length).toBeGreaterThan(0);
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('should have higher confidence for decisions with rationale', () => {
      const withRationale = detectUserIntent(
        "I decided to use cursor pagination because it scales better"
      );
      const withoutRationale = detectUserIntent(
        "I decided to use cursor pagination"
      );

      expect(withRationale.decisions[0].confidence).toBeGreaterThan(
        withoutRationale.decisions[0].confidence
      );
    });
  });

  describe('extractEntities', () => {
    it('should extract technologies', () => {
      const entities = extractEntities("Using PostgreSQL with FastAPI and React");
      expect(entities).toContain('postgresql');
      expect(entities).toContain('fastapi');
      expect(entities).toContain('react');
    });

    it('should extract patterns', () => {
      const entities = extractEntities("Implementing cursor-pagination with dependency-injection");
      expect(entities).toContain('cursor-pagination');
      expect(entities).toContain('dependency-injection');
    });

    it('should extract tools', () => {
      const entities = extractEntities("Using grep to search and git for version control");
      expect(entities).toContain('grep');
      expect(entities).toContain('git');
    });

    it('should handle empty text', () => {
      const entities = extractEntities("");
      expect(entities).toEqual([]);
    });
  });

  describe('hasDecisionLanguage', () => {
    it('should return true for decision keywords', () => {
      expect(hasDecisionLanguage("I decided to use X")).toBe(true);
      expect(hasDecisionLanguage("let's use Y")).toBe(true);
      expect(hasDecisionLanguage("I chose Z")).toBe(true);
    });

    it('should return false for non-decision text', () => {
      expect(hasDecisionLanguage("Hello world")).toBe(false);
      expect(hasDecisionLanguage("What is the weather?")).toBe(false);
    });
  });

  describe('hasProblemLanguage', () => {
    it('should return true for problem keywords', () => {
      expect(hasProblemLanguage("There is an error")).toBe(true);
      expect(hasProblemLanguage("The test is failing")).toBe(true);
      expect(hasProblemLanguage("It's not working")).toBe(true);
    });

    it('should return false for non-problem text', () => {
      expect(hasProblemLanguage("Everything is great")).toBe(false);
      expect(hasProblemLanguage("Show me the code")).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const result = detectUserIntent(
        "I decided to use @typescript/eslint-plugin for linting"
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

    it('should deduplicate overlapping intents', () => {
      const result = detectUserIntent(
        "I decided to use PostgreSQL because I chose PostgreSQL"
      );
      // Should not have duplicate decisions for the same text
      expect(result.decisions.length).toBeLessThanOrEqual(2);
    });
  });
});

/**
 * Unit tests for communication-style-tracker hook
 * Tests UserPromptSubmit hook that detects user communication patterns
 * Part of Issue #245: Multi-User Intelligent Decision Capture System (Phase 2.2)
 */

import { describe, test, expect } from 'vitest';
import type { HookInput } from '../../types.js';
import {
  communicationStyleTracker,
  detectVerbosity,
  detectInteractionType,
  detectTechnicalLevel,
  detectCommunicationStyle,
  TERSE_MAX_LENGTH,
  MODERATE_MAX_LENGTH,
} from '../../prompt/communication-style-tracker.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create UserPromptSubmit input for testing
 */
function createPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session-123',
    project_dir: '/tmp/test-project',
    tool_input: {},
    prompt,
    ...overrides,
  };
}

// =============================================================================
// Tests: Basic Behavior
// =============================================================================

describe('prompt/communication-style-tracker', () => {
  describe('basic behavior', () => {
    test('returns silent success for empty prompt', () => {
      const input = createPromptInput('');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for very short prompt', () => {
      const input = createPromptInput('hi');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success for slash commands', () => {
      const input = createPromptInput('/commit fix the bug');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('always continues execution', () => {
      const prompts = [
        '',
        'hi',
        '/commit',
        'Fix the bug in the login system',
        'How do I implement pagination?',
        'Let me explain my architecture thoughts.',
      ];

      for (const prompt of prompts) {
        const input = createPromptInput(prompt);
        const result = communicationStyleTracker(input);
        expect(result.continue).toBe(true);
      }
    });
  });

  // =============================================================================
  // Tests: Verbosity Detection
  // =============================================================================

  describe('detectVerbosity', () => {
    describe('terse detection', () => {
      test('detects terse for short prompts', () => {
        expect(detectVerbosity('fix it')).toBe('terse');
        expect(detectVerbosity('run tests')).toBe('terse');
        expect(detectVerbosity('add a button')).toBe('terse');
      });

      test('detects terse for prompts under threshold', () => {
        const tersePrompt = 'a'.repeat(TERSE_MAX_LENGTH);
        expect(detectVerbosity(tersePrompt)).toBe('terse');
      });
    });

    describe('moderate detection', () => {
      test('detects moderate for medium-length prompts', () => {
        const moderatePrompt = 'Please update the user service to handle the new authentication flow.';
        expect(detectVerbosity(moderatePrompt)).toBe('moderate');
      });

      test('detects moderate for prompts between thresholds', () => {
        const moderatePrompt = 'a'.repeat(TERSE_MAX_LENGTH + 10);
        expect(detectVerbosity(moderatePrompt)).toBe('moderate');
      });
    });

    describe('detailed detection', () => {
      test('detects detailed for long prompts', () => {
        const detailedPrompt = 'a'.repeat(MODERATE_MAX_LENGTH + 10);
        expect(detectVerbosity(detailedPrompt)).toBe('detailed');
      });

      test('detects detailed when has multiple sentences', () => {
        const multiSentence = 'First do this task. Then do the next one. Finally wrap up.';
        expect(detectVerbosity(multiSentence)).toBe('detailed');
      });

      test('detects detailed when has explanation keywords', () => {
        expect(detectVerbosity('Fix the bug because it breaks production')).toBe('detailed');
        expect(detectVerbosity('Add caching since performance is slow')).toBe('detailed');
        expect(detectVerbosity('Update the API in order to support pagination')).toBe('detailed');
      });

      test('detects detailed when has context keywords', () => {
        expect(detectVerbosity('Context: we need to refactor the auth module')).toBe('detailed');
        expect(detectVerbosity('Previously we used cookies for session management')).toBe('detailed');
        expect(detectVerbosity('Currently the system handles 1000 requests per second')).toBe('detailed');
      });
    });
  });

  // =============================================================================
  // Tests: Interaction Type Detection
  // =============================================================================

  describe('detectInteractionType', () => {
    describe('question detection', () => {
      test('detects questions starting with question words', () => {
        expect(detectInteractionType('How do I implement this?')).toBe('question');
        expect(detectInteractionType('What is the best approach?')).toBe('question');
        expect(detectInteractionType('Why does this fail?')).toBe('question');
        expect(detectInteractionType('When should I use hooks?')).toBe('question');
        expect(detectInteractionType('Where is the config file?')).toBe('question');
        expect(detectInteractionType('Which pattern is better?')).toBe('question');
        expect(detectInteractionType('Who owns this module?')).toBe('question');
      });

      test('detects questions ending with question mark', () => {
        expect(detectInteractionType('This needs to be fixed?')).toBe('question');
        expect(detectInteractionType('The tests are passing?')).toBe('question');
      });

      test('detects questions with "can you/can I" patterns', () => {
        expect(detectInteractionType('Can you help me debug this?')).toBe('question');
        expect(detectInteractionType('Can I use async/await here?')).toBe('question');
        expect(detectInteractionType('Could you explain this pattern?')).toBe('question');
        expect(detectInteractionType('Would you recommend this approach?')).toBe('question');
      });

      test('detects questions with "explain/tell me" patterns', () => {
        expect(detectInteractionType('Explain how this works')).toBe('question');
        expect(detectInteractionType('Tell me about the architecture')).toBe('question');
        expect(detectInteractionType('Show me how to implement this')).toBe('question');
        expect(detectInteractionType('Help me understand the flow')).toBe('question');
      });
    });

    describe('command detection', () => {
      test('detects commands starting with action verbs', () => {
        expect(detectInteractionType('Fix the bug')).toBe('command');
        expect(detectInteractionType('Add a new feature')).toBe('command');
        expect(detectInteractionType('Create the endpoint')).toBe('command');
        expect(detectInteractionType('Update the schema')).toBe('command');
        expect(detectInteractionType('Remove the old code')).toBe('command');
        expect(detectInteractionType('Delete the file')).toBe('command');
        expect(detectInteractionType('Run the tests')).toBe('command');
        expect(detectInteractionType('Build the project')).toBe('command');
        expect(detectInteractionType('Test this function')).toBe('command');
        expect(detectInteractionType('Deploy to staging')).toBe('command');
      });

      test('detects commands with imperative patterns', () => {
        expect(detectInteractionType('Just fix it')).toBe('command');
        expect(detectInteractionType('Please add the feature')).toBe('command');
        expect(detectInteractionType('Now run the tests')).toBe('command');
        expect(detectInteractionType('Quickly build it')).toBe('command');
      });

      test('detects commands with pronoun patterns', () => {
        expect(detectInteractionType('Fix it')).toBe('command');
        expect(detectInteractionType('Run this')).toBe('command');
        expect(detectInteractionType('Update that')).toBe('command');
        expect(detectInteractionType('Test the component')).toBe('command');
      });

      test('detects short prompts as commands by default', () => {
        expect(detectInteractionType('more info')).toBe('command');
        expect(detectInteractionType('continue')).toBe('command');
      });
    });

    describe('discussion detection', () => {
      test('detects discussions with opinion patterns', () => {
        expect(detectInteractionType('I think we should refactor this')).toBe('discussion');
        expect(detectInteractionType('I believe the architecture is wrong')).toBe('discussion');
        expect(detectInteractionType('Maybe we could try a different approach')).toBe('discussion');
        expect(detectInteractionType('Perhaps this is not the best solution')).toBe('discussion');
      });

      test('detects discussions with deliberation patterns', () => {
        expect(detectInteractionType("Let's discuss the trade-offs")).toBe('discussion');
        expect(detectInteractionType('What if we used a different pattern?')).toBe('discussion');
        expect(detectInteractionType('Consider using a microservice architecture')).toBe('discussion');
        expect(detectInteractionType("I'm wondering if this approach is scalable")).toBe('discussion');
      });

      test('detects discussions with comparison keywords', () => {
        expect(detectInteractionType('Alternatively, we could use MongoDB')).toBe('discussion');
        expect(detectInteractionType('On the other hand, REST is simpler')).toBe('discussion');
        expect(detectInteractionType('However, this has performance implications')).toBe('discussion');
        expect(detectInteractionType('We should evaluate the pros and cons')).toBe('discussion');
      });

      test('detects discussions with experience patterns', () => {
        expect(detectInteractionType('In my experience, this pattern works well')).toBe('discussion');
        expect(detectInteractionType('From what I\'ve seen, caching helps a lot')).toBe('discussion');
        expect(detectInteractionType('Generally, we prefer TypeScript')).toBe('discussion');
        expect(detectInteractionType('Typically, this approach is faster')).toBe('discussion');
      });
    });
  });

  // =============================================================================
  // Tests: Technical Level Detection
  // =============================================================================

  describe('detectTechnicalLevel', () => {
    describe('beginner detection', () => {
      test('detects beginner with explanatory questions', () => {
        expect(detectTechnicalLevel('What is a REST API?')).toBe('beginner');
        expect(detectTechnicalLevel('How does React work?')).toBe('beginner');
        expect(detectTechnicalLevel('Explain what a hook is')).toBe('beginner');
      });

      test('detects beginner with confusion and newbie patterns', () => {
        // Multiple beginner patterns to ensure beginner score wins
        expect(detectTechnicalLevel("I'm a newbie and don't understand the basics")).toBe('beginner');
        expect(detectTechnicalLevel("Can you explain step by step for a beginner")).toBe('beginner');
        expect(detectTechnicalLevel("I'm new and confused, explain like I'm a starter")).toBe('beginner');
      });

      test('detects beginner with simplicity requests', () => {
        expect(detectTechnicalLevel('Can you explain step by step?')).toBe('beginner');
        expect(detectTechnicalLevel('Explain it for dummies')).toBe('beginner');
        expect(detectTechnicalLevel('Keep it simple please')).toBe('beginner');
        expect(detectTechnicalLevel('Show me the basics')).toBe('beginner');
      });

      test('detects beginner with learning and tutorial keywords', () => {
        // Use multiple beginner patterns without intermediate terms
        expect(detectTechnicalLevel("I'm learning, show me the basics please")).toBe('beginner');
        expect(detectTechnicalLevel('Any good tutorials for a beginner like me?')).toBe('beginner');
        expect(detectTechnicalLevel('Is this a good starter tutorial for newbies?')).toBe('beginner');
      });
    });

    describe('expert detection', () => {
      test('detects expert with AI/ML terminology', () => {
        // These have strong expert patterns
        expect(detectTechnicalLevel('Configure pgvector for embeddings')).toBe('expert');
        expect(detectTechnicalLevel('Implement RAG with HNSW index')).toBe('expert');
        expect(detectTechnicalLevel('Use LLM for tokenization')).toBe('expert');
        expect(detectTechnicalLevel('Transformer attention mechanism')).toBe('expert');
      });

      test('detects expert with distributed systems terms', () => {
        expect(detectTechnicalLevel('Implement sharding strategy')).toBe('expert');
        expect(detectTechnicalLevel('Handle partition tolerance')).toBe('expert');
        expect(detectTechnicalLevel('Ensure eventual consistency')).toBe('expert');
        expect(detectTechnicalLevel('Apply CAP theorem constraints')).toBe('expert');
      });

      test('detects expert with infrastructure terminology', () => {
        expect(detectTechnicalLevel('Deploy with Kubernetes')).toBe('expert');
        expect(detectTechnicalLevel('Configure k8s helm chart')).toBe('expert');
        expect(detectTechnicalLevel('Setup istio service mesh')).toBe('expert');
        expect(detectTechnicalLevel('Container orchestration with K8s')).toBe('expert');
      });

      test('detects expert with concurrency patterns', () => {
        expect(detectTechnicalLevel('Fix the race condition')).toBe('expert');
        expect(detectTechnicalLevel('Use mutex for thread safety')).toBe('expert');
        expect(detectTechnicalLevel('Implement semaphore pattern')).toBe('expert');
        expect(detectTechnicalLevel('Handle deadlock scenario')).toBe('expert');
      });

      test('detects expert with multiple expert terms', () => {
        // Multiple expert patterns to ensure threshold is met
        expect(detectTechnicalLevel('Handle race condition with mutex and semaphore')).toBe('expert');
        expect(detectTechnicalLevel('Use idempotent operations with eventual consistency')).toBe('expert');
        expect(detectTechnicalLevel('Implement HNSW index for RAG embeddings')).toBe('expert');
      });
    });

    describe('intermediate detection', () => {
      test('detects intermediate with common dev terms', () => {
        expect(detectTechnicalLevel('Create a REST API endpoint')).toBe('intermediate');
        expect(detectTechnicalLevel('Setup JWT authentication')).toBe('intermediate');
        expect(detectTechnicalLevel('Add GraphQL resolver')).toBe('intermediate');
        expect(detectTechnicalLevel('Configure middleware')).toBe('intermediate');
      });

      test('detects intermediate with frontend terms', () => {
        expect(detectTechnicalLevel('Update the React component')).toBe('intermediate');
        expect(detectTechnicalLevel('Use useState hook')).toBe('intermediate');
        expect(detectTechnicalLevel('Pass data via props')).toBe('intermediate');
        expect(detectTechnicalLevel('Add Redux store')).toBe('intermediate');
      });

      test('detects intermediate with database terms', () => {
        expect(detectTechnicalLevel('Create migration script')).toBe('intermediate');
        expect(detectTechnicalLevel('Update the schema')).toBe('intermediate');
        expect(detectTechnicalLevel('Add ORM model')).toBe('intermediate');
        expect(detectTechnicalLevel('Write SQL query')).toBe('intermediate');
      });

      test('detects intermediate with multiple intermediate terms', () => {
        // Prompts with 2+ intermediate patterns (need >40 chars to avoid short-command expert bonus)
        expect(detectTechnicalLevel('Please write unit tests for the React component in this project')).toBe('intermediate');
        expect(detectTechnicalLevel('Add integration tests for the API endpoint including middleware')).toBe('intermediate');
        expect(detectTechnicalLevel('Create migration for the schema changes in the database')).toBe('intermediate');
      });

      test('detects intermediate with git terms', () => {
        expect(detectTechnicalLevel('Create feature branch')).toBe('intermediate');
        expect(detectTechnicalLevel('Merge PR changes')).toBe('intermediate');
        expect(detectTechnicalLevel('Rebase onto main')).toBe('intermediate');
        expect(detectTechnicalLevel('Fix commit message')).toBe('intermediate');
      });
    });

    describe('ambiguous cases', () => {
      test('defaults to intermediate for generic prompts', () => {
        expect(detectTechnicalLevel('Fix the problem')).toBe('intermediate');
        expect(detectTechnicalLevel('Update the code')).toBe('intermediate');
        expect(detectTechnicalLevel('Make it work')).toBe('intermediate');
      });
    });
  });

  // =============================================================================
  // Tests: Full Communication Style Detection
  // =============================================================================

  describe('detectCommunicationStyle', () => {
    test('detects terse expert command', () => {
      const style = detectCommunicationStyle('fix race condition');
      expect(style.verbosity).toBe('terse');
      expect(style.interaction_type).toBe('command');
      expect(style.technical_level).toBe('expert');
    });

    test('detects detailed beginner question', () => {
      // Long prompt with multiple beginner patterns and no intermediate/expert terms
      const style = detectCommunicationStyle(
        "I'm a complete newbie and very confused. Can you explain step by step how this works for a beginner like me? I need the basics explained."
      );
      expect(style.verbosity).toBe('detailed');
      expect(style.interaction_type).toBe('question');
      expect(style.technical_level).toBe('beginner');
    });

    test('detects moderate intermediate discussion', () => {
      const style = detectCommunicationStyle(
        "I think we should add JWT authentication to our API endpoints"
      );
      expect(style.verbosity).toBe('moderate');
      expect(style.interaction_type).toBe('discussion');
      expect(style.technical_level).toBe('intermediate');
    });

    test('detects detailed expert discussion', () => {
      const style = detectCommunicationStyle(
        "Let's discuss the trade-offs between cursor-based pagination and offset pagination. In my experience, cursor-based pagination scales better for large datasets because it maintains O(1) performance regardless of the offset."
      );
      expect(style.verbosity).toBe('detailed');
      expect(style.interaction_type).toBe('discussion');
      expect(style.technical_level).toBe('expert');
    });
  });

  // =============================================================================
  // Tests: Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    test('handles prompts with only whitespace', () => {
      const input = createPromptInput('   ');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles prompts with special characters', () => {
      const input = createPromptInput('Fix the bug in file.ts:42');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with newlines', () => {
      const input = createPromptInput('Fix the bug\nIn the login form\nPlease');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompts with unicode', () => {
      const input = createPromptInput('Add emoji support 🎉 to the app');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
    });

    test('handles very long prompts', () => {
      const longPrompt = 'This is a test. '.repeat(100);
      const input = createPromptInput(longPrompt);
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
    });
  });
});

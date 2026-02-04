/**
 * Tests for tool-categories.ts
 * Issue #245 Phase 4: Tool Usage Tracking
 */

import { describe, test, expect } from 'vitest';
import {
  getToolCategory,
  getToolsInCategory,
  areSameCategory,
  getCategoryDescription,
  TOOL_CATEGORIES,
  type ToolCategory,
} from '../../lib/tool-categories.js';

describe('tool-categories', () => {
  describe('getToolCategory', () => {
    test('returns correct category for search tools', () => {
      expect(getToolCategory('Grep')).toBe('search');
      expect(getToolCategory('Glob')).toBe('search');
    });

    test('returns correct category for file tools', () => {
      expect(getToolCategory('Read')).toBe('file_read');
      expect(getToolCategory('Write')).toBe('file_write');
      expect(getToolCategory('Edit')).toBe('file_edit');
      expect(getToolCategory('MultiEdit')).toBe('file_edit');
      expect(getToolCategory('NotebookEdit')).toBe('file_edit');
    });

    test('returns correct category for execution tools', () => {
      expect(getToolCategory('Bash')).toBe('execution');
    });

    test('returns correct category for agent/skill tools', () => {
      expect(getToolCategory('Task')).toBe('agent');
      expect(getToolCategory('Skill')).toBe('skill');
    });

    test('returns correct category for web tools', () => {
      expect(getToolCategory('WebFetch')).toBe('web');
      expect(getToolCategory('WebSearch')).toBe('web');
    });

    test('returns correct category for interaction tools', () => {
      expect(getToolCategory('AskUserQuestion')).toBe('interaction');
      expect(getToolCategory('EnterPlanMode')).toBe('interaction');
      expect(getToolCategory('ExitPlanMode')).toBe('interaction');
    });

    test('returns correct category for task management tools', () => {
      expect(getToolCategory('TaskCreate')).toBe('task_mgmt');
      expect(getToolCategory('TaskUpdate')).toBe('task_mgmt');
      expect(getToolCategory('TaskList')).toBe('task_mgmt');
      expect(getToolCategory('TaskGet')).toBe('task_mgmt');
      expect(getToolCategory('TaskOutput')).toBe('task_mgmt');
      expect(getToolCategory('TaskStop')).toBe('task_mgmt');
    });

    test('returns "other" for unknown tools', () => {
      expect(getToolCategory('UnknownTool')).toBe('other');
      expect(getToolCategory('CustomTool')).toBe('other');
      expect(getToolCategory('')).toBe('other');
    });
  });

  describe('getToolsInCategory', () => {
    test('returns all search tools', () => {
      const searchTools = getToolsInCategory('search');
      expect(searchTools).toContain('Grep');
      expect(searchTools).toContain('Glob');
    });

    test('returns all file_edit tools', () => {
      const editTools = getToolsInCategory('file_edit');
      expect(editTools).toContain('Edit');
      expect(editTools).toContain('MultiEdit');
      expect(editTools).toContain('NotebookEdit');
    });

    test('returns empty array for category with no tools', () => {
      // All known categories have tools, but test edge case
      const tools = getToolsInCategory('other');
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('areSameCategory', () => {
    test('returns true for tools in same category', () => {
      expect(areSameCategory('Grep', 'Glob')).toBe(true);
      expect(areSameCategory('Edit', 'MultiEdit')).toBe(true);
      expect(areSameCategory('TaskCreate', 'TaskUpdate')).toBe(true);
    });

    test('returns false for tools in different categories', () => {
      expect(areSameCategory('Read', 'Write')).toBe(false);
      expect(areSameCategory('Grep', 'Bash')).toBe(false);
      expect(areSameCategory('Task', 'Skill')).toBe(false);
    });

    test('returns true for unknown tools (both "other")', () => {
      expect(areSameCategory('Unknown1', 'Unknown2')).toBe(true);
    });
  });

  describe('getCategoryDescription', () => {
    test('returns descriptions for all categories', () => {
      const categories: ToolCategory[] = [
        'search',
        'file_read',
        'file_write',
        'file_edit',
        'execution',
        'agent',
        'skill',
        'web',
        'interaction',
        'task_mgmt',
        'other',
      ];

      for (const cat of categories) {
        const desc = getCategoryDescription(cat);
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TOOL_CATEGORIES constant', () => {
    test('covers all expected Claude Code tools', () => {
      const expectedTools = [
        'Grep',
        'Glob',
        'Read',
        'Write',
        'Edit',
        'MultiEdit',
        'NotebookEdit',
        'Bash',
        'Task',
        'Skill',
        'WebFetch',
        'WebSearch',
        'AskUserQuestion',
        'TaskCreate',
        'TaskUpdate',
        'TaskList',
        'TaskGet',
        'TaskOutput',
        'TaskStop',
        'EnterPlanMode',
        'ExitPlanMode',
      ];

      for (const tool of expectedTools) {
        expect(TOOL_CATEGORIES[tool]).toBeDefined();
      }
    });

    test('has valid category values for all entries', () => {
      const validCategories: ToolCategory[] = [
        'search',
        'file_read',
        'file_write',
        'file_edit',
        'execution',
        'agent',
        'skill',
        'web',
        'interaction',
        'task_mgmt',
        'other',
      ];

      for (const category of Object.values(TOOL_CATEGORIES)) {
        expect(validCategories).toContain(category);
      }
    });
  });
});

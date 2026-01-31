/**
 * Tool Categories
 * Issue #245 Phase 4: Tool Usage Tracking
 *
 * Maps Claude Code tools to semantic categories for:
 * - Usage pattern analysis
 * - Tool preference learning
 * - Workflow detection
 *
 * Categories align with user workflow intentions, not implementation details.
 */

/**
 * Tool category types
 */
export type ToolCategory =
  | 'search'        // Finding files/content: Grep, Glob, WebSearch
  | 'file_read'     // Reading files: Read
  | 'file_write'    // Creating files: Write
  | 'file_edit'     // Modifying files: Edit, MultiEdit, NotebookEdit
  | 'execution'     // Running commands: Bash
  | 'agent'         // Spawning agents: Task
  | 'skill'         // Invoking skills: Skill
  | 'web'           // Web access: WebFetch, WebSearch
  | 'interaction'   // User interaction: AskUserQuestion
  | 'task_mgmt'     // Task management: TaskCreate, TaskUpdate, TaskList, TaskGet
  | 'other';        // Unknown/uncategorized

/**
 * Static tool → category mapping
 *
 * This mapping covers all known Claude Code tools as of CC 2.1.22.
 * Unknown tools default to 'other'.
 */
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Search tools - finding files and content
  Grep: 'search',
  Glob: 'search',
  WebSearch: 'web',

  // File reading
  Read: 'file_read',

  // File writing (creation)
  Write: 'file_write',

  // File editing (modification)
  Edit: 'file_edit',
  MultiEdit: 'file_edit',
  NotebookEdit: 'file_edit',

  // Execution
  Bash: 'execution',

  // Agent/skill invocation
  Task: 'agent',
  Skill: 'skill',

  // Web access
  WebFetch: 'web',

  // User interaction
  AskUserQuestion: 'interaction',

  // Task management (CC 2.1.16)
  TaskCreate: 'task_mgmt',
  TaskUpdate: 'task_mgmt',
  TaskList: 'task_mgmt',
  TaskGet: 'task_mgmt',
  TaskOutput: 'task_mgmt',
  TaskStop: 'task_mgmt',

  // Planning
  EnterPlanMode: 'interaction',
  ExitPlanMode: 'interaction',
};

/**
 * Get the category for a tool
 *
 * @param toolName - The name of the tool (e.g., 'Grep', 'Read')
 * @returns The tool's category, or 'other' if unknown
 *
 * @example
 * getToolCategory('Grep')  // 'search'
 * getToolCategory('Read')  // 'file_read'
 * getToolCategory('CustomTool')  // 'other'
 */
export function getToolCategory(toolName: string): ToolCategory {
  return TOOL_CATEGORIES[toolName] || 'other';
}

/**
 * Get all tools in a category
 *
 * @param category - The category to look up
 * @returns Array of tool names in that category
 *
 * @example
 * getToolsInCategory('search')  // ['Grep', 'Glob']
 */
export function getToolsInCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_CATEGORIES)
    .filter(([, cat]) => cat === category)
    .map(([tool]) => tool);
}

/**
 * Check if two tools are in the same category
 *
 * @param tool1 - First tool name
 * @param tool2 - Second tool name
 * @returns true if both tools are in the same category
 *
 * @example
 * areSameCategory('Grep', 'Glob')  // true (both 'search')
 * areSameCategory('Read', 'Write') // false
 */
export function areSameCategory(tool1: string, tool2: string): boolean {
  return getToolCategory(tool1) === getToolCategory(tool2);
}

/**
 * Get a human-readable description of a category
 *
 * @param category - The category
 * @returns Description of what tools in this category do
 */
export function getCategoryDescription(category: ToolCategory): string {
  const descriptions: Record<ToolCategory, string> = {
    search: 'Finding files and content',
    file_read: 'Reading file contents',
    file_write: 'Creating new files',
    file_edit: 'Modifying existing files',
    execution: 'Running shell commands',
    agent: 'Spawning specialized agents',
    skill: 'Invoking skills',
    web: 'Accessing web resources',
    interaction: 'User interaction',
    task_mgmt: 'Managing tasks',
    other: 'Other operations',
  };
  return descriptions[category];
}

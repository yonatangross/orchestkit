/**
 * Intent Classifier - Hybrid semantic+keyword scoring engine
 * Issue #197: Agent Orchestration Layer
 *
 * Scoring weights:
 * - Keyword matching: 30%
 * - Phrase pattern matching: 25%
 * - Context continuity: 20%
 * - Co-occurrence learning: 15%
 * - Negation detection: 10%
 *
 * Target: 85%+ accuracy vs ~60% regex baseline
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPluginRoot, logHook } from './common.js';
import {
  THRESHOLDS,
  type AgentMatch,
  type SkillMatch,
  type IntentSignal,
  type ClassificationResult,
  type CalibrationAdjustment,
} from './orchestration-types.js';

// -----------------------------------------------------------------------------
// Constants and Weights
// -----------------------------------------------------------------------------

/** Scoring weights for signal types (must sum to 100) */
const SIGNAL_WEIGHTS = {
  keyword: 30,
  phrase: 25,
  context: 20,
  cooccurrence: 15,
  negation: 10,
} as const;

/** Negation patterns that reduce confidence */
const NEGATION_PATTERNS = [
  /\b(not|don't|doesn't|won't|can't|shouldn't|avoid|without|except|unlike|instead of)\s+/i,
  /\b(no|never|neither|nor)\s+/i,
];

/** Context keywords that boost confidence when in history */
const CONTEXT_BOOST_KEYWORDS = [
  'continue',
  'also',
  'additionally',
  'and',
  'then',
  'next',
  'follow up',
  'after that',
];

// -----------------------------------------------------------------------------
// Agent Index Cache
// -----------------------------------------------------------------------------

interface AgentIndexEntry {
  keywords: string[];
  phrases: string[];
  description: string;
  skills?: string[];
}

let agentIndex: Map<string, AgentIndexEntry> | null = null;
let agentIndexPath: string | null = null;

/**
 * Build or get cached agent index from agents/ directory
 */
function getAgentIndex(agentsDir: string): Map<string, AgentIndexEntry> {
  // Return cache if path matches
  if (agentIndex && agentIndexPath === agentsDir) {
    return agentIndex;
  }

  const index = new Map<string, AgentIndexEntry>();

  try {
    const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const agentName = file.replace('.md', '');
      const filePath = join(agentsDir, file);

      try {
        const content = readFileSync(filePath, 'utf8');

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;

        const frontmatter = frontmatterMatch[1];

        // Extract description
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (!descMatch) continue;

        const description = descMatch[1].trim();

        // Extract "Activates for" keywords
        const activatesMatch = description.match(/Activates for\s+(.+?)\.?$/i);

        // Also check for keywords in description before "Activates for"
        const descPart = activatesMatch
          ? description.slice(0, description.indexOf('Activates for')).trim()
          : description;

        let keywords: string[] = [];
        let phrases: string[] = [];

        if (activatesMatch) {
          const keywordsStr = activatesMatch[1];
          const rawKeywords = keywordsStr.split(/,\s*/).map(k => k.trim().toLowerCase());

          // Separate phrases (multi-word) from single keywords
          for (const kw of rawKeywords) {
            if (kw.includes(' ') || kw.includes('-')) {
              phrases.push(kw);
            } else if (kw.length > 1) {
              keywords.push(kw);
            }
          }
        }

        // Extract skills from frontmatter
        const skillsMatch = frontmatter.match(/^skills:\s*\n((?:\s+-\s+.+\n?)+)/m);
        let skills: string[] | undefined;
        if (skillsMatch) {
          skills = skillsMatch[1]
            .split('\n')
            .map(l => l.replace(/^\s*-\s*/, '').trim())
            .filter(Boolean);
        }

        if (keywords.length > 0 || phrases.length > 0) {
          index.set(agentName, {
            keywords,
            phrases,
            description: descPart || description.split('.')[0],
            skills,
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    logHook('intent-classifier', 'Could not read agents directory');
  }

  agentIndex = index;
  agentIndexPath = agentsDir;
  return index;
}

// -----------------------------------------------------------------------------
// Skill Index Cache
// -----------------------------------------------------------------------------

interface SkillIndexEntry {
  keywords: string[];
  description: string;
}

let skillIndex: Map<string, SkillIndexEntry> | null = null;
let skillIndexPath: string | null = null;

/**
 * Build or get cached skill index from skills/ directory
 */
function getSkillIndex(skillsDir: string): Map<string, SkillIndexEntry> {
  if (skillIndex && skillIndexPath === skillsDir) {
    return skillIndex;
  }

  const index = new Map<string, SkillIndexEntry>();

  try {
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const skillName of dirs) {
      const skillFile = join(skillsDir, skillName, 'SKILL.md');

      if (!existsSync(skillFile)) continue;

      try {
        const content = readFileSync(skillFile, 'utf8');

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;

        const frontmatter = frontmatterMatch[1];

        // Extract description
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        const description = descMatch ? descMatch[1].trim() : '';

        // Extract tags as keywords
        const tagsMatch = frontmatter.match(/^tags:\s*\[([^\]]+)\]/m);
        let keywords: string[] = [];

        if (tagsMatch) {
          keywords = tagsMatch[1]
            .split(',')
            .map(t => t.trim().toLowerCase().replace(/["']/g, ''))
            .filter(t => t.length > 1);
        }

        // Also extract keywords from description
        const descKeywords = description
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 5);

        keywords = [...new Set([...keywords, ...descKeywords])];

        if (keywords.length > 0 || description) {
          index.set(skillName, { keywords, description });
        }
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    logHook('intent-classifier', 'Could not read skills directory');
  }

  skillIndex = index;
  skillIndexPath = skillsDir;
  return index;
}

// -----------------------------------------------------------------------------
// Classification Logic
// -----------------------------------------------------------------------------

/**
 * Calculate keyword match score for an agent
 */
function calculateKeywordScore(
  promptLower: string,
  keywords: string[]
): { score: number; matched: string[]; signals: IntentSignal[] } {
  let score = 0;
  const matched: string[] = [];
  const signals: IntentSignal[] = [];

  for (const keyword of keywords) {
    // Check word boundary match
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(promptLower)) {
      const weight = keyword.length > 5 ? 25 : 20; // Longer keywords are more specific
      score += weight;
      matched.push(keyword);
      signals.push({
        type: 'keyword',
        source: 'keyword-match',
        weight,
        matched: keyword,
      });
    }
  }

  // Normalize to percentage of max possible
  const maxScore = keywords.length * 25;
  return {
    score: maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0,
    matched,
    signals,
  };
}

/**
 * Calculate phrase match score (multi-word patterns)
 */
function calculatePhraseScore(
  promptLower: string,
  phrases: string[]
): { score: number; matched: string[]; signals: IntentSignal[] } {
  let score = 0;
  const matched: string[] = [];
  const signals: IntentSignal[] = [];

  for (const phrase of phrases) {
    if (promptLower.includes(phrase)) {
      const weight = phrase.split(/\s+/).length * 15; // More words = higher weight
      score += weight;
      matched.push(phrase);
      signals.push({
        type: 'phrase',
        source: 'phrase-match',
        weight,
        matched: phrase,
      });
    }
  }

  // Normalize to percentage of max possible
  const maxScore = phrases.length * 45; // Assume avg 3 words per phrase
  return {
    score: maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0,
    matched,
    signals,
  };
}

/**
 * Calculate context continuity score from prompt history
 */
function calculateContextScore(
  promptLower: string,
  keywords: string[],
  history: string[]
): { score: number; signals: IntentSignal[] } {
  if (history.length === 0) {
    return { score: 0, signals: [] };
  }

  const signals: IntentSignal[] = [];
  let score = 0;

  // Check for continuation keywords
  for (const continuationWord of CONTEXT_BOOST_KEYWORDS) {
    if (promptLower.includes(continuationWord)) {
      score += 15;
      signals.push({
        type: 'context',
        source: 'continuation-keyword',
        weight: 15,
        matched: continuationWord,
      });
      break; // Only count once
    }
  }

  // Check if agent keywords appeared in recent history
  const recentHistory = history.slice(-3).join(' ').toLowerCase();
  for (const keyword of keywords.slice(0, 5)) {
    if (recentHistory.includes(keyword)) {
      score += 20;
      signals.push({
        type: 'context',
        source: 'history-keyword',
        weight: 20,
        matched: keyword,
      });
    }
  }

  return { score: Math.min(score, 100), signals };
}

/**
 * Calculate negation penalty
 */
function calculateNegationPenalty(prompt: string): { penalty: number; signals: IntentSignal[] } {
  const signals: IntentSignal[] = [];
  let penalty = 0;

  for (const pattern of NEGATION_PATTERNS) {
    if (pattern.test(prompt)) {
      penalty = 25; // Significant penalty for negation
      signals.push({
        type: 'negation',
        source: 'negation-detected',
        weight: -25,
        matched: prompt.match(pattern)?.[0] || 'negation',
      });
      break;
    }
  }

  return { penalty, signals };
}

/**
 * Apply calibration adjustments to score
 */
function applyCalibration(
  agentName: string,
  matchedKeywords: string[],
  adjustments: CalibrationAdjustment[]
): { adjustment: number; signals: IntentSignal[] } {
  if (adjustments.length === 0) {
    return { adjustment: 0, signals: [] };
  }

  let totalAdjustment = 0;
  const signals: IntentSignal[] = [];

  for (const adj of adjustments) {
    if (adj.agent === agentName && matchedKeywords.includes(adj.keyword)) {
      totalAdjustment += adj.adjustment;
      signals.push({
        type: adj.adjustment > 0 ? 'boost' : 'penalty',
        source: 'calibration',
        weight: adj.adjustment,
        matched: `${adj.keyword}:${agentName}`,
      });
    }
  }

  return { adjustment: totalAdjustment, signals };
}

/**
 * Classify a single agent match
 */
function classifyAgentMatch(
  promptLower: string,
  agentName: string,
  entry: AgentIndexEntry,
  history: string[],
  adjustments: CalibrationAdjustment[]
): AgentMatch | null {
  const allSignals: IntentSignal[] = [];
  const allMatched: string[] = [];

  // 1. Keyword matching (30% weight)
  const keywordResult = calculateKeywordScore(promptLower, entry.keywords);
  allSignals.push(...keywordResult.signals);
  allMatched.push(...keywordResult.matched);

  // 2. Phrase matching (25% weight)
  const phraseResult = calculatePhraseScore(promptLower, entry.phrases);
  allSignals.push(...phraseResult.signals);
  allMatched.push(...phraseResult.matched);

  // 3. Context continuity (20% weight)
  const contextResult = calculateContextScore(promptLower, entry.keywords, history);
  allSignals.push(...contextResult.signals);

  // 4. Negation detection (10% weight as penalty)
  const negationResult = calculateNegationPenalty(promptLower);
  allSignals.push(...negationResult.signals);

  // 5. Calibration adjustments (applies to final score)
  const calibrationResult = applyCalibration(agentName, allMatched, adjustments);
  allSignals.push(...calibrationResult.signals);

  // Calculate weighted score
  let score =
    keywordResult.score * (SIGNAL_WEIGHTS.keyword / 100) +
    phraseResult.score * (SIGNAL_WEIGHTS.phrase / 100) +
    contextResult.score * (SIGNAL_WEIGHTS.context / 100);

  // Apply negation penalty
  score -= negationResult.penalty * (SIGNAL_WEIGHTS.negation / 100);

  // Apply calibration adjustment (up to +/-15 points)
  score += Math.max(-15, Math.min(15, calibrationResult.adjustment));

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Only return if above minimum threshold
  if (score < THRESHOLDS.MINIMUM) {
    return null;
  }

  return {
    agent: agentName,
    confidence: Math.round(score),
    description: entry.description,
    matchedKeywords: allMatched,
    signals: allSignals,
  };
}

/**
 * Classify skill match
 */
function classifySkillMatch(
  promptLower: string,
  skillName: string,
  entry: SkillIndexEntry
): SkillMatch | null {
  const signals: IntentSignal[] = [];
  const matched: string[] = [];
  let score = 0;

  for (const keyword of entry.keywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(promptLower)) {
      const weight = keyword.length > 5 ? 25 : 20;
      score += weight;
      matched.push(keyword);
      signals.push({
        type: 'keyword',
        source: 'skill-keyword',
        weight,
        matched: keyword,
      });
    }
  }

  // Cap at 100
  score = Math.min(score, 100);

  if (score < THRESHOLDS.MINIMUM) {
    return null;
  }

  return {
    skill: skillName,
    confidence: Math.round(score),
    description: entry.description,
    matchedKeywords: matched,
    signals,
  };
}

// -----------------------------------------------------------------------------
// Main Classification Function
// -----------------------------------------------------------------------------

/**
 * Classify user prompt intent and find matching agents/skills
 *
 * @param prompt - The user's input prompt
 * @param history - Recent prompt history for context continuity
 * @param adjustments - Calibration adjustments from outcome learning
 * @returns Classification result with agents, skills, and confidence
 */
export function classifyIntent(
  prompt: string,
  history: string[] = [],
  adjustments: CalibrationAdjustment[] = []
): ClassificationResult {
  const pluginRoot = getPluginRoot();
  const agentsDir = join(pluginRoot, 'agents');
  const skillsDir = join(pluginRoot, 'skills');

  const promptLower = prompt.toLowerCase();

  const allSignals: IntentSignal[] = [];
  const agentMatches: AgentMatch[] = [];
  const skillMatches: SkillMatch[] = [];

  // Classify agents
  const agentIdx = getAgentIndex(agentsDir);
  for (const [agentName, entry] of agentIdx) {
    const match = classifyAgentMatch(
      promptLower,
      agentName,
      entry,
      history,
      adjustments
    );
    if (match) {
      agentMatches.push(match);
      allSignals.push(...match.signals);
    }
  }

  // Classify skills
  const skillIdx = getSkillIndex(skillsDir);
  for (const [skillName, entry] of skillIdx) {
    const match = classifySkillMatch(promptLower, skillName, entry);
    if (match) {
      skillMatches.push(match);
      allSignals.push(...match.signals);
    }
  }

  // Sort by confidence
  agentMatches.sort((a, b) => b.confidence - a.confidence);
  skillMatches.sort((a, b) => b.confidence - a.confidence);

  // Determine primary intent from top agent
  const topAgent = agentMatches[0];
  const intent = topAgent
    ? categorizeIntent(topAgent.agent, topAgent.matchedKeywords)
    : 'general';

  const maxConfidence = Math.max(
    topAgent?.confidence || 0,
    skillMatches[0]?.confidence || 0
  );

  const shouldAutoDispatch =
    topAgent !== undefined && topAgent.confidence >= THRESHOLDS.AUTO_DISPATCH;

  const shouldInjectSkills =
    skillMatches.length > 0 &&
    skillMatches[0].confidence >= THRESHOLDS.SKILL_INJECT;

  return {
    agents: agentMatches.slice(0, 3), // Top 3
    skills: skillMatches.slice(0, 5), // Top 5
    intent,
    confidence: maxConfidence,
    signals: allSignals,
    shouldAutoDispatch,
    shouldInjectSkills,
  };
}

/**
 * Categorize intent based on agent and keywords
 */
function categorizeIntent(agent: string, keywords: string[]): string {
  const categories: Record<string, string[]> = {
    'api-design': ['api', 'endpoint', 'rest', 'graphql', 'route'],
    'database': ['database', 'schema', 'migration', 'sql', 'query'],
    'authentication': ['auth', 'login', 'jwt', 'oauth', 'session'],
    'frontend': ['react', 'component', 'ui', 'form', 'state'],
    'testing': ['test', 'coverage', 'mock', 'fixture', 'e2e'],
    'devops': ['deploy', 'ci', 'cd', 'release', 'monitor'],
    'ai-integration': ['llm', 'rag', 'embedding', 'langgraph', 'agent'],
    'security': ['security', 'owasp', 'xss', 'injection', 'csrf'],
  };

  for (const [category, categoryKeywords] of Object.entries(categories)) {
    for (const kw of keywords) {
      if (categoryKeywords.includes(kw)) {
        return category;
      }
    }
  }

  // Fallback to agent-based categorization
  if (agent.includes('backend') || agent.includes('api')) return 'api-design';
  if (agent.includes('frontend') || agent.includes('ui')) return 'frontend';
  if (agent.includes('test')) return 'testing';
  if (agent.includes('security')) return 'security';

  return 'general';
}

/**
 * Quick check if prompt likely needs orchestration
 * Use this for fast filtering before full classification
 */
export function shouldClassify(prompt: string): boolean {
  if (prompt.length < 10) return false;

  // Skip meta questions about agents/skills
  if (/what agents|list agents|available agents|what skills/i.test(prompt)) {
    return false;
  }

  // Skip simple commands
  if (/^(yes|no|ok|thanks|done|continue|stop)$/i.test(prompt.trim())) {
    return false;
  }

  return true;
}

/**
 * Clear cached indices (useful for testing or when agents/skills change)
 */
export function clearCache(): void {
  agentIndex = null;
  agentIndexPath = null;
  skillIndex = null;
  skillIndexPath = null;
}

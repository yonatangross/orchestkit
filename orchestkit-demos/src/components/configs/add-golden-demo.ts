/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:add-golden skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const addGoldenDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "add-golden",
  skillCommand: "/ork:add-golden",
  hook: "Curate your training data gold standard",
  primaryColor: "#f59e0b",
  secondaryColor: "#22c55e",
  accentColor: "#8b5cf6",

  phases: [
    { name: "Analyze Input", shortName: "Analyze" },
    { name: "Validate Quality", shortName: "Validate" },
    { name: "Extract Features", shortName: "Extract" },
    { name: "Add to Dataset", shortName: "Store" },
  ],

  // SIMPLE LEVEL - Add single example
  simple: {
    name: "Simple",
    description: "add API response example",
    inputCount: 1,
    files: [
      {
        name: "data/golden/",
        status: "completed",
        children: [
          { name: "api-responses.jsonl", status: "completed", lines: 45 },
        ],
      },
    ],
    references: [
      { name: "golden-dataset-curation", status: "loaded", category: "data" },
      { name: "quality-validation", status: "loaded", category: "qa" },
    ],
    claudeResponse: [
      "Adding to golden dataset:",
      "",
      "• Input: 1 example",
      "• Format: API response",
      "• Quality: Validated",
      "• Dataset: api-responses",
    ],
    codeSnippet: `GOLDEN DATASET UPDATED
─────────────────────
Dataset: api-responses.jsonl

New Example Added:
┌─ Input
│  POST /api/users
│  {"name": "Alice", "email": "alice@example.com"}
│
├─ Expected Output
│  {"id": "usr_123", "name": "Alice", "status": "created"}
│
├─ Metadata
│  ✓ Category: user-management
│  ✓ Tags: [create, validation, success]
│  ✓ Difficulty: simple
│  ✓ Source: production-logs
│
└─ Quality Checks
   ✓ Schema valid
   ✓ No PII detected
   ✓ Deterministic output
   ✓ Unique (no duplicates)

Dataset Stats:
├─ Total examples: 46
├─ Coverage: user-management 100%
└─ Quality score: 9.8/10`,
    completionTime: "3s",
    metrics: {
      Examples: "1",
      Dataset: "api-responses",
      Quality: "9.8/10",
    },
  },

  // MEDIUM LEVEL - Add batch with validation
  medium: {
    name: "Medium",
    description: "add error handling examples",
    inputCount: 12,
    files: [
      {
        name: "data/golden/",
        status: "completed",
        children: [
          { name: "error-responses.jsonl", status: "completed", lines: 156 },
          { name: "validation-errors.jsonl", status: "completed", lines: 89 },
          { name: "edge-cases.jsonl", status: "writing", lines: 67 },
        ],
      },
    ],
    references: [
      { name: "golden-dataset-curation", status: "loaded", category: "data" },
      { name: "error-taxonomy", status: "loaded", category: "validation" },
      { name: "edge-case-detection", status: "loading", category: "testing" },
    ],
    claudeResponse: [
      "Adding error handling examples:",
      "",
      "• Input: 12 examples",
      "• Validated: 11 passed",
      "• Rejected: 1 (duplicate)",
      "• Categories: 4 error types",
      "• Coverage improved: +15%",
    ],
    codeSnippet: `GOLDEN DATASET UPDATED
─────────────────────
Batch: error-handling-examples

Processing Results:
┌─ Accepted (11 examples)
│  ├─ 400 Bad Request (3)
│  │   ✓ Missing required field
│  │   ✓ Invalid email format
│  │   ✓ Exceeds max length
│  │
│  ├─ 401 Unauthorized (2)
│  │   ✓ Expired token
│  │   ✓ Invalid signature
│  │
│  ├─ 404 Not Found (3)
│  │   ✓ User not found
│  │   ✓ Resource deleted
│  │   ✓ Invalid route
│  │
│  └─ 500 Internal Error (3)
│      ✓ Database timeout
│      ✓ Third-party failure
│      ✓ Unhandled exception
│
├─ Rejected (1 example)
│  ✗ Duplicate of existing example
│    Reason: 98% similarity to error_045
│
└─ Quality Validation
   ✓ Schema compliance: 100%
   ✓ PII scan: Clean
   ✓ Determinism check: Passed
   ✓ Edge case coverage: +15%

Dataset Stats:
├─ error-responses.jsonl: 167 examples
├─ validation-errors.jsonl: 89 examples
├─ edge-cases.jsonl: 67 examples
├─ Total coverage: 78% → 93%
└─ Quality score: 9.6/10

Recommendations:
⚠ Missing: 429 Rate Limit examples
⚠ Missing: 503 Service Unavailable
💡 Run: /add-golden --generate rate-limit`,
    completionTime: "12s",
    metrics: {
      Accepted: "11",
      Rejected: "1",
      Coverage: "93%",
      Quality: "9.6/10",
    },
  },

  // ADVANCED LEVEL - Full dataset curation
  advanced: {
    name: "Advanced",
    description: "curate ML training dataset",
    inputCount: 156,
    files: [
      {
        name: "data/golden/",
        status: "completed",
        children: [
          {
            name: "training/",
            status: "completed",
            children: [
              { name: "positive-examples.jsonl", status: "completed", lines: 2456 },
              { name: "negative-examples.jsonl", status: "completed", lines: 1234 },
              { name: "edge-cases.jsonl", status: "completed", lines: 567 },
            ],
          },
          {
            name: "validation/",
            status: "completed",
            children: [
              { name: "holdout-set.jsonl", status: "completed", lines: 456 },
              { name: "adversarial.jsonl", status: "writing", lines: 234 },
            ],
          },
          {
            name: "test/",
            status: "pending",
            children: [
              { name: "benchmark.jsonl", status: "pending", lines: 0 },
            ],
          },
        ],
      },
    ],
    references: [
      { name: "golden-dataset-curation", status: "loaded", category: "data" },
      { name: "ml-data-quality", status: "loaded", category: "ml" },
      { name: "dataset-balancing", status: "loaded", category: "stats" },
      { name: "adversarial-examples", status: "loading", category: "security" },
      { name: "benchmark-creation", status: "pending", category: "eval" },
    ],
    claudeResponse: [
      "Curating ML training dataset:",
      "",
      "• Input: 156 raw examples",
      "• Validated: 148 accepted",
      "• Rejected: 8 (quality issues)",
      "• Auto-generated: 24 adversarial",
      "• Train/Val/Test: 70/15/15",
      "• Class balance: Optimized",
      "• Dedup: 12 removed",
    ],
    codeSnippet: `GOLDEN DATASET CURATION COMPLETE
─────────────────────────────────
Project: intent-classification-v2

PROCESSING SUMMARY:
╔════════════════════════════════════════════════════════════╗
║ ML TRAINING DATASET CURATED                                ║
╚════════════════════════════════════════════════════════════╝

┌─ Input Processing (156 examples)
│  ├─ Accepted: 148 (94.9%)
│  ├─ Rejected: 8 (5.1%)
│  │   ├─ Ambiguous label: 3
│  │   ├─ PII detected: 2
│  │   ├─ Duplicate: 2
│  │   └─ Schema invalid: 1
│  │
│  └─ Auto-Augmented: 24
│      ├─ Adversarial perturbations: 12
│      ├─ Synonym replacements: 8
│      └─ Typo injection: 4
│
├─ Dataset Split (172 total)
│  ├─ Training: 120 (70%)
│  │   ├─ positive-examples.jsonl: 67
│  │   ├─ negative-examples.jsonl: 38
│  │   └─ edge-cases.jsonl: 15
│  │
│  ├─ Validation: 26 (15%)
│  │   └─ holdout-set.jsonl: 26
│  │
│  └─ Test: 26 (15%)
│      ├─ benchmark.jsonl: 18
│      └─ adversarial.jsonl: 8
│
├─ Class Distribution
│  ├─ Intent: greet (23%)
│  ├─ Intent: query (28%)
│  ├─ Intent: command (31%)
│  ├─ Intent: farewell (10%)
│  └─ Intent: other (8%)
│  ✓ Balance score: 0.92 (excellent)
│
├─ Quality Metrics
│  ├─ Label consistency: 98.2%
│  ├─ Inter-annotator agreement: 0.94 kappa
│  ├─ PII compliance: 100%
│  ├─ Schema compliance: 100%
│  ├─ Uniqueness: 100% (after dedup)
│  └─ Difficulty distribution:
│      ├─ Easy: 40%
│      ├─ Medium: 45%
│      └─ Hard: 15%
│
├─ Feature Analysis
│  ├─ Avg token length: 12.4
│  ├─ Vocabulary size: 2,456 unique tokens
│  ├─ OOV estimate: 3.2%
│  └─ Domain coverage: 94%
│
├─ Versioning
│  ├─ Version: v2.1.0
│  ├─ Previous: v2.0.0 (1,234 examples)
│  ├─ Delta: +172 examples (+13.9%)
│  └─ Changelog: AUTO-GENERATED
│
└─ Export Formats
   ✓ JSONL (primary)
   ✓ CSV (compatibility)
   ✓ HuggingFace datasets
   ✓ TensorFlow tfrecord

RECOMMENDATIONS:
┌─ Coverage Gaps Detected
│  ⚠ Missing: multi-language examples (0%)
│  ⚠ Missing: code-mixed queries (2%)
│  ⚠ Low: negation patterns (5%)
│
├─ Suggested Actions
│  1. /add-golden --generate multi-language
│  2. /add-golden --augment negation
│  3. Review adversarial edge cases
│
└─ Next Steps
   → Train model on v2.1.0
   → Run benchmark comparison
   → Schedule human review for rejects

Dataset Location:
  data/golden/intent-classification-v2/
  └─ README.md (auto-generated documentation)`,
    completionTime: "45s",
    metrics: {
      Accepted: "148",
      Augmented: "24",
      "Train/Val/Test": "120/26/26",
      Balance: "0.92",
      Quality: "9.4/10",
    },
  },

  summaryTitle: "GOLDEN DATASET CURATED",
  summaryTagline: "Quality data in. Quality AI out. Production ready.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default addGoldenDemoConfig;

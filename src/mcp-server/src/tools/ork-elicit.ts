/**
 * ork_elicit tool — structured form elicitation via MCP
 *
 * Accepts either:
 * - preset: a known preset name (e.g. "project-config") that maps to a predefined schema
 * - fields: ad-hoc JSON Schema for custom forms
 *
 * Returns structured JSON with action (accept/decline/cancel) + values + env_vars (for presets).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import {
  projectConfigSchema,
  projectConfigMessage,
  mapProjectConfigToEnv,
  type ProjectConfigValues,
} from '../presets/index.js';

/** Secrets that must never appear in elicitation fields */
const BLOCKED_FIELD_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /private[_-]?key/i,
];

function containsBlockedField(fields: Record<string, unknown>): string | null {
  const properties = (fields as { properties?: Record<string, unknown> })
    .properties;
  if (!properties) return null;
  for (const fieldName of Object.keys(properties)) {
    for (const pattern of BLOCKED_FIELD_PATTERNS) {
      if (pattern.test(fieldName)) {
        return fieldName;
      }
    }
  }
  return null;
}

interface PresetDef {
  schema: Record<string, unknown>;
  message: string;
}

const PRESETS: Record<string, PresetDef> = {
  'project-config': {
    schema: projectConfigSchema,
    message: projectConfigMessage,
  },
};

function jsonResult(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  };
}

export function registerElicitTool(mcpServer: McpServer): void {
  mcpServer.tool(
    'ork_elicit',
    'Present a structured form dialog to the user via MCP elicitation. Use preset for known forms or fields for ad-hoc schemas.',
    {
      message: z.string().optional().describe('Header message shown above the form'),
      preset: z
        .string()
        .optional()
        .describe('Named preset: "project-config". Overrides message and fields.'),
      fields: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Ad-hoc JSON Schema (type: object with properties). Ignored when preset is set.',
        ),
    },
    async (args) => {
      const { message, preset, fields } = args;

      // Resolve schema and message from preset or ad-hoc fields
      let schema: Record<string, unknown>;
      let formMessage: string;

      if (preset) {
        const presetDef = PRESETS[preset];
        if (!presetDef) {
          return jsonResult({
            error: `Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}`,
          });
        }
        schema = presetDef.schema;
        formMessage = presetDef.message;
      } else if (fields) {
        schema = fields as Record<string, unknown>;
        formMessage = message || 'Please fill in the following:';
      } else {
        return jsonResult({
          error: 'Either preset or fields must be provided.',
        });
      }

      // Guard: block fields that look like secrets
      const blockedField = containsBlockedField(schema);
      if (blockedField) {
        return jsonResult({
          error: `Blocked: field "${blockedField}" looks like a secret. Secrets must be set via environment variables, not elicitation forms.`,
        });
      }

      // Call elicitInput on the underlying Server instance
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime schema is plain JSON
        const result = await mcpServer.server.elicitInput({
          message: formMessage,
          requestedSchema: schema,
        } as any);

        const action = (result as ElicitResult).action;
        const values = (result as ElicitResult).content;

        const response: Record<string, unknown> = {
          action,
          values: values || null,
        };

        // For presets, also map to env vars
        if (preset && action === 'accept' && values) {
          if (preset === 'project-config') {
            response.env_vars = mapProjectConfigToEnv(
              values as unknown as ProjectConfigValues,
            );
          }
        }

        return jsonResult(response);
      } catch (err) {
        return jsonResult({
          error: `Elicitation failed: ${err instanceof Error ? err.message : String(err)}`,
          fallback: true,
        });
      }
    },
  );
}


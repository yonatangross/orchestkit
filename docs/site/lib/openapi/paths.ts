// OpenAPI `paths` for the public docs API — referenced from
// app/api/openapi/route.ts. Each operation mirrors a route handler under
// app/api/ (or /ask via rewrite); keep the two in sync when either changes.

import { RATE_LIMIT_HEADER_REFS } from "./components";

const ASK_RESPONSES = {
	"200": { $ref: "#/components/responses/AskOk" },
	"400": { $ref: "#/components/responses/Problem" },
	"429": { $ref: "#/components/responses/TooManyRequests" },
	"500": { $ref: "#/components/responses/Problem" },
} as const;

export const OPENAPI_PATHS = {
	"/api/search": {
		get: {
			operationId: "searchDocs",
			summary: "Full-text search across the documentation",
			description:
				'Returns documentation pages matching a search term, ranked by relevance. Use this to find the right doc before fetching its Markdown. Paginate with `limit` + the opaque `cursor` from `X-Next-Cursor` (or the `Link: rel="next"` header).',
			tags: ["search"],
			parameters: [
				{
					name: "query",
					in: "query",
					required: true,
					description: "Search term, e.g. 'install' or 'memory'.",
					schema: { type: "string", minLength: 1 },
				},
				{ $ref: "#/components/parameters/Limit" },
				{ $ref: "#/components/parameters/Cursor" },
				{
					name: "tag",
					in: "query",
					required: false,
					description:
						"Filter by content type: docs | skill | agent | hook | composition.",
					schema: {
						type: "string",
						enum: ["docs", "skill", "agent", "hook", "composition"],
					},
				},
			],
			responses: {
				"200": {
					description: "Ranked search results (one page).",
					headers: {
						"X-Total-Count": {
							description: "Total matches before pagination was applied.",
							schema: { type: "integer" },
						},
						"X-Next-Cursor": {
							description: "Opaque cursor for the next page; absent on the last page.",
							schema: { type: "string" },
						},
						Link: {
							description:
								'RFC 8288 web link to the next page (`rel="next"`); absent on the last page.',
							schema: { type: "string" },
						},
						...RATE_LIMIT_HEADER_REFS,
					},
					content: {
						"application/json": {
							schema: {
								type: "array",
								items: { $ref: "#/components/schemas/SearchResult" },
							},
						},
					},
				},
				"400": { $ref: "#/components/responses/Problem" },
				"429": { $ref: "#/components/responses/TooManyRequests" },
				"500": { $ref: "#/components/responses/Problem" },
			},
		},
	},
	"/ask": {
		get: {
			operationId: "askQuestionGet",
			summary: "Answer a natural-language question about OrchestKit (NLWeb, GET)",
			description:
				"NLWeb endpoint, GET form. Pass the natural-language question as `?query=` (aliases: `q`, `question`). Returns matching documentation as structured JSON with a `_meta` block. Pass `?streaming=true` (or `Accept: text/event-stream`) to stream results as Server-Sent Events with NLWeb event types: start, result, complete.",
			tags: ["ask"],
			parameters: [
				{
					name: "query",
					in: "query",
					required: true,
					description: "The natural-language question.",
					schema: { type: "string", minLength: 1 },
				},
				{
					name: "mode",
					in: "query",
					required: false,
					description: "NLWeb response mode.",
					schema: {
						type: "string",
						enum: ["list", "summarize", "generate"],
						default: "list",
					},
				},
				{
					name: "streaming",
					in: "query",
					required: false,
					description: "Set to `true` for an SSE stream instead of a JSON document.",
					schema: { type: "boolean", default: false },
				},
				{ $ref: "#/components/parameters/IdempotencyKey" },
			],
			responses: ASK_RESPONSES,
		},
		post: {
			operationId: "askQuestion",
			summary: "Answer a natural-language question about OrchestKit (NLWeb, POST)",
			description:
				"NLWeb endpoint. Accepts a natural-language query (JSON or form-encoded body) and returns matching documentation as structured JSON (with a `_meta` block). Send `Accept: text/event-stream`, `streaming: true`, or `prefer.streaming: true` to stream results as Server-Sent Events.",
			tags: ["ask"],
			parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/AskRequest" },
					},
					"application/x-www-form-urlencoded": {
						schema: { $ref: "#/components/schemas/AskRequest" },
					},
				},
			},
			responses: {
				...ASK_RESPONSES,
				"415": { $ref: "#/components/responses/Problem" },
			},
		},
	},
	"/api/md/batch": {
		post: {
			operationId: "batchGetMarkdown",
			summary: "Fetch up to 20 documentation pages as Markdown in one request",
			description:
				"Batch read: pass an array of doc URL paths (e.g. `/docs/getting-started/installation`) and receive each page's Markdown in a single response. Per-path failures are reported inline so one bad path does not fail the batch. Reads are idempotent; an `Idempotency-Key` header is echoed back.",
			tags: ["docs"],
			parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/BatchMarkdownRequest" },
					},
				},
			},
			responses: {
				"200": {
					description: "Per-path results, in request order.",
					headers: { ...RATE_LIMIT_HEADER_REFS },
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/BatchMarkdownResponse" },
						},
					},
				},
				"400": { $ref: "#/components/responses/Problem" },
				"429": { $ref: "#/components/responses/TooManyRequests" },
				"500": { $ref: "#/components/responses/Problem" },
			},
		},
	},
	"/api/health": {
		get: {
			operationId: "getHealth",
			summary: "Liveness check",
			description: "Returns 200 with service name and version when serving.",
			tags: ["meta"],
			responses: {
				"200": {
					description: "Service is serving.",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", examples: ["ok"] },
									service: { type: "string" },
									version: { type: "string" },
								},
								required: ["status"],
							},
						},
					},
				},
				"503": { $ref: "#/components/responses/Problem" },
			},
		},
	},
} as const;

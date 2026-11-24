// MCP protocol versions the hosted Streamable HTTP servers (/api/mcp and
// /api/mcp/actions) implement, newest first. Both accept JSON-RPC batches,
// which the two older revisions require.
// Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#version-negotiation
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export const LATEST_PROTOCOL_VERSION: ProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS[0];

function isSupported(version: unknown): version is ProtocolVersion {
	return SUPPORTED_PROTOCOL_VERSIONS.some((supported) => supported === version);
}

// The initialize response echoes a requested version only when it is
// supported; otherwise it offers the latest one and the client decides.
export function negotiateProtocolVersion(requested: unknown): ProtocolVersion {
	return isSupported(requested) ? requested : LATEST_PROTOCOL_VERSION;
}

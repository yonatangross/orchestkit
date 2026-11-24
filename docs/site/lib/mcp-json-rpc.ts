export type RpcRequest = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown> | unknown[];
};

type DispatchPair = { request: RpcRequest; response: object | null };

export function rpcError(id: RpcRequest["id"], code: number, message: string) {
	return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

function isRpcRequest(value: unknown): value is RpcRequest {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;

	const { jsonrpc, method, id, params } = value as Record<string, unknown>;
	return jsonrpc === "2.0" && typeof method === "string" &&
		(id === undefined || id === null || typeof id === "string" || typeof id === "number") &&
		(params === undefined || (params !== null && typeof params === "object"));
}

export async function handleMcpPost(
	request: Request,
	dispatch: (request: RpcRequest) => Promise<object | null>,
	onDispatch?: (pairs: DispatchPair[]) => void,
): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
	}

	const invalidRequest = rpcError(null, -32600, "Invalid Request");
	const batch: unknown[] | null = Array.isArray(payload) ? payload : null;
	const entries = batch ?? [payload];
	if (entries.length === 0) return Response.json(invalidRequest, { status: 400 });

	const pairs = await Promise.all(entries.map(async (entry) => {
		if (!isRpcRequest(entry)) return { request: null, response: invalidRequest };
		return { request: entry, response: await dispatch(entry) };
	}));

	if (!batch && pairs[0].request === null) {
		return Response.json(invalidRequest, { status: 400 });
	}
	onDispatch?.(pairs.filter((pair): pair is DispatchPair => pair.request !== null));

	const responses = pairs.map((pair) => pair.response).filter((response) => response !== null);
	if (responses.length === 0) return new Response(null, { status: 202 });

	return Response.json(batch ? responses : responses[0]);
}

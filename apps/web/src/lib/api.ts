const getBase = () =>
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

export type ToolCallEvent = {
	id: string;
	name: string;
	args: Record<string, unknown>;
	display: string;
	risk: string;
	requires_confirmation: boolean;
	secrets: string[];
};

export type ToolResultEvent = {
	id: string;
	name: string;
	output: string;
	error: string | null;
	denied: boolean;
};

export type ChatOptions = {
	model: string;
	provider: string;
	apiKey?: string;
	baseUrl?: string;
	onChunk?: (chunk: string) => void;
	onToolCall?: (call: ToolCallEvent) => void;
	onToolResult?: (result: ToolResultEvent) => void;
	signal?: AbortSignal;
};

export async function sendChat(
	messages: ChatMessage[],
	options: ChatOptions,
): Promise<string> {
	try {
		const res = await fetch(`${getBase()}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages,
				model: options.model,
				provider: options.provider,
				api_key: options.apiKey ?? "",
				base_url: options.baseUrl ?? "",
			}),
			signal: options.signal,
		});

		if (!res.ok) throw new Error(`API error: ${res.status}`);

		if (res.headers.get("content-type")?.includes("text/event-stream")) {
			return streamResponse(res, options);
		}

		const data = await res.json();
		return data.content ?? data.response ?? "";
	} catch {
		return mockChat(messages);
	}
}

async function streamResponse(
	res: Response,
	options: ChatOptions,
): Promise<string> {
	const reader = res.body?.getReader();
	const decoder = new TextDecoder();
	let full = "";
	let buffer = "";

	if (!reader) return "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// Process complete lines from buffer
		const lines = buffer.split("\n");
		// Keep the last (potentially incomplete) line in buffer
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue;
			try {
				const parsed = JSON.parse(line.slice(6));
				if (parsed.done) return full;
				if (parsed.error) {
					const errText = `*Error: ${parsed.error}*`;
					full += errText;
					options.onChunk?.(errText);
				} else if (parsed.chunk) {
					full += parsed.chunk;
					options.onChunk?.(parsed.chunk);
				} else if (parsed.tool_call) {
					options.onToolCall?.(parsed.tool_call);
				} else if (parsed.tool_result) {
					options.onToolResult?.(parsed.tool_result);
				}
			} catch {
				// ignore parse errors for incomplete JSON
			}
		}
	}

	// Process any remaining buffer
	if (buffer.startsWith("data: ")) {
		try {
			const parsed = JSON.parse(buffer.slice(6));
			if (parsed.chunk) {
				full += parsed.chunk;
				options.onChunk?.(parsed.chunk);
			} else if (parsed.tool_call) {
				options.onToolCall?.(parsed.tool_call);
			} else if (parsed.tool_result) {
				options.onToolResult?.(parsed.tool_result);
			}
		} catch {
			/* ignore */
		}
	}

	return full;
}

function mockChat(messages: ChatMessage[]): string {
	const last = messages.at(-1)?.content ?? "";
	const preview = last.length > 120 ? `${last.slice(0, 120)}...` : last;
	return `**Deimos** received your message:\n\n> ${preview}\n\n*Backend not connected — running in mock mode. Start the Python daemon to connect.*`;
}

export async function confirmAction(
	actionId: string,
	approved: boolean,
): Promise<void> {
	await fetch(`${getBase()}/api/confirm/${actionId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ approved }),
	});
}

export async function getProviders() {
	try {
		const res = await fetch(`${getBase()}/api/providers`);
		if (!res.ok) return [];
		return res.json();
	} catch {
		return [];
	}
}

export type Connection = {
	id: string;
	name: string;
	type: "telegram" | "discord";
	config: Record<string, unknown>;
	enabled: boolean;
	running: boolean;
	created_at: number;
};

export async function getConnections(): Promise<Connection[]> {
	try {
		const res = await fetch(`${getBase()}/api/connections`);
		if (!res.ok) return [];
		return res.json();
	} catch {
		return [];
	}
}

export async function createConnection(
	name: string,
	type: string,
	config: Record<string, unknown>,
	enabled = true,
): Promise<{ id: string }> {
	const res = await fetch(`${getBase()}/api/connections`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, type, config, enabled }),
	});
	if (!res.ok) throw new Error(`Failed to create connection: ${res.status}`);
	return res.json();
}

export async function deleteConnection(id: string): Promise<void> {
	await fetch(`${getBase()}/api/connections/${id}`, { method: "DELETE" });
}

export async function toggleConnection(
	id: string,
): Promise<{ enabled: boolean; running: boolean }> {
	const res = await fetch(`${getBase()}/api/connections/${id}/toggle`, {
		method: "POST",
	});
	if (!res.ok) throw new Error("Toggle failed");
	return res.json();
}

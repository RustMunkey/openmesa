export type Role = "user" | "assistant" | "tool";

export type ToolRisk =
	| "safe"
	| "standard"
	| "elevated"
	| "dangerous"
	| "secret";
export type ToolCallStatus =
	| "awaiting_confirmation"
	| "running"
	| "done"
	| "denied";

export type ToolCall = {
	id: string;
	name: string;
	args: Record<string, unknown>;
	display: string;
	risk: ToolRisk;
	status: ToolCallStatus;
	output?: string;
	error?: string;
	secrets?: string[];
};

export type Message = {
	id: string;
	role: Role;
	content: string;
	toolCalls?: ToolCall[];
	createdAt: number;
	model?: string;
};

export type Conversation = {
	id: string;
	title: string;
	messages: Message[];
	model: string;
	provider: string;
	createdAt: number;
	updatedAt: number;
};

export type ProviderId =
	| "anthropic"
	| "openai"
	| "google"
	| "mistral"
	| "groq"
	| "xai"
	| "cohere"
	| "perplexity"
	| "deepseek"
	| "together"
	| "openrouter"
	| "fireworks"
	| "cerebras"
	| "azure"
	| "huggingface"
	| "ai21"
	| "ollama";

export type Provider = {
	id: ProviderId;
	name: string;
	models: string[];
	requiresKey: boolean;
	baseUrl?: string;
	fetchModels?: (key: string, baseUrl?: string) => Promise<string[]>;
};

export type MemoryItem = {
	id: string;
	content: string;
	source: "pinned" | "auto" | "note";
	pinnedAt: number;
};

import type { Provider } from "@/lib/agent/types";

// OpenAI-compatible /v1/models parser
async function fetchOpenAIModels(
	key: string,
	baseUrl: string,
): Promise<string[]> {
	const res = await fetch(`${baseUrl}/v1/models`, {
		headers: { Authorization: `Bearer ${key}` },
	});
	if (!res.ok) throw new Error(`${res.status}`);
	const data = await res.json();
	return (data.data as { id: string }[]).map((m) => m.id).sort();
}

export const PROVIDERS: Provider[] = [
	{
		id: "anthropic",
		name: "Anthropic",
		models: [
			"claude-opus-4-6",
			"claude-sonnet-4-6",
			"claude-haiku-4-5-20251001",
			"claude-opus-4-5-20251101",
			"claude-sonnet-4-5-20250929",
			"claude-opus-4-1-20250805",
			"claude-sonnet-4-20250514",
			"claude-opus-4-20250514",
		],
		requiresKey: true,
		fetchModels: async (key) => {
			const res = await fetch("https://api.anthropic.com/v1/models", {
				headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
			});
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			return (data.data as { id: string }[]).map((m) => m.id).sort();
		},
	},
	{
		id: "openai",
		name: "OpenAI",
		models: [
			"gpt-5.2",
			"gpt-5.2-pro",
			"gpt-5-mini",
			"o3",
			"o3-pro",
			"o4-mini",
			"gpt-4.1",
			"gpt-4.1-mini",
			"gpt-4.1-nano",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.openai.com"),
	},
	{
		id: "google",
		name: "Google",
		models: [
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gemini-3.1-pro-preview",
			"gemini-3-flash-preview",
			"gemini-2.0-flash",
		],
		requiresKey: true,
		fetchModels: async (key) => {
			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
			);
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			return (
				data.models as { name: string; supportedGenerationMethods?: string[] }[]
			)
				.filter((m) =>
					m.supportedGenerationMethods?.includes("generateContent"),
				)
				.map((m) => m.name.replace("models/", ""))
				.sort();
		},
	},
	{
		id: "mistral",
		name: "Mistral",
		models: [
			"mistral-large-3-25-12",
			"mistral-medium-3-1-25-08",
			"mistral-small-3-2-25-06",
			"magistral-medium-1-2-25-09",
			"magistral-small-1-2-25-09",
			"codestral-2508",
			"devstral-2-25-12",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.mistral.ai"),
	},
	{
		id: "groq",
		name: "Groq",
		models: [
			"llama-3.3-70b-versatile",
			"llama-3.1-8b-instant",
			"openai/gpt-oss-120b",
			"openai/gpt-oss-20b",
			"groq/compound",
			"groq/compound-mini",
			"meta-llama/llama-4-maverick-17b-128e-instruct",
			"meta-llama/llama-4-scout-17b-16e-instruct",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.groq.com/openai"),
	},
	{
		id: "xai",
		name: "xAI",
		models: [
			"grok-4-0709",
			"grok-4-1-fast-reasoning",
			"grok-4-1-fast-non-reasoning",
			"grok-4-fast-reasoning",
			"grok-3",
			"grok-3-mini",
			"grok-2-vision-1212",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.x.ai"),
	},
	{
		id: "cohere",
		name: "Cohere",
		models: [
			"command-a-03-2025",
			"command-a-reasoning-08-2025",
			"command-a-vision-07-2025",
			"command-r7b-12-2024",
			"command-r-plus-08-2024",
			"command-r-08-2024",
		],
		requiresKey: true,
		fetchModels: async (key) => {
			const res = await fetch("https://api.cohere.com/v1/models", {
				headers: { Authorization: `Bearer ${key}` },
			});
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			return (data.models as { name: string }[]).map((m) => m.name).sort();
		},
	},
	{
		id: "perplexity",
		name: "Perplexity",
		models: [
			"sonar-deep-research",
			"sonar-reasoning-pro",
			"sonar-reasoning",
			"sonar-pro",
			"sonar",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.perplexity.ai"),
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		models: ["deepseek-chat", "deepseek-reasoner"],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.deepseek.com"),
	},
	{
		id: "together",
		name: "Together AI",
		models: [
			"meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
			"deepseek-ai/DeepSeek-V3.1",
			"deepseek-ai/DeepSeek-R1",
			"Qwen/Qwen3.5-397B-A17B",
			"Qwen/Qwen2.5-7B-Instruct-Turbo",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.together.xyz"),
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		models: [
			"openrouter/auto",
			"anthropic/claude-sonnet-4-6",
			"openai/gpt-5.2",
			"google/gemini-2.5-pro",
			"x-ai/grok-4-0709",
			"deepseek/deepseek-chat",
		],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://openrouter.ai/api"),
	},
	{
		id: "fireworks",
		name: "Fireworks AI",
		models: [
			"accounts/fireworks/models/llama-v3p3-70b-instruct",
			"accounts/fireworks/models/llama-v3p1-8b-instruct",
			"accounts/fireworks/models/deepseek-v3p1",
			"accounts/fireworks/models/qwen3-8b",
			"accounts/fireworks/models/qwen2p5-coder-7b",
			"accounts/fireworks/models/firefunction-v2",
		],
		requiresKey: true,
		fetchModels: (key) =>
			fetchOpenAIModels(key, "https://api.fireworks.ai/inference"),
	},
	{
		id: "cerebras",
		name: "Cerebras",
		models: ["llama3.1-8b", "gpt-oss-120b"],
		requiresKey: true,
		fetchModels: (key) => fetchOpenAIModels(key, "https://api.cerebras.ai"),
	},
	{
		id: "azure",
		name: "Azure OpenAI",
		models: ["gpt-4o", "gpt-4o-mini", "o1-mini"],
		requiresKey: true,
		baseUrl: "https://<resource>.openai.azure.com",
	},
	{
		id: "huggingface",
		name: "Hugging Face",
		models: [
			"meta-llama/Meta-Llama-3.1-70B-Instruct",
			"meta-llama/Meta-Llama-3.1-8B-Instruct",
			"mistralai/Mistral-7B-Instruct-v0.3",
			"Qwen/Qwen2.5-72B-Instruct",
		],
		requiresKey: true,
	},
	{
		id: "ai21",
		name: "AI21 Labs",
		models: ["jamba-large", "jamba-mini", "jamba-large-1.7", "jamba-mini-2"],
		requiresKey: true,
		fetchModels: async (key) => {
			const res = await fetch("https://api.ai21.com/studio/v1/models", {
				headers: { Authorization: `Bearer ${key}` },
			});
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			return (data as { id: string }[]).map((m) => m.id).sort();
		},
	},
	{
		id: "ollama",
		name: "Ollama (Local)",
		models: [
			"llama3.1",
			"llama3.2",
			"deepseek-r1",
			"gemma3",
			"qwen3",
			"qwen2.5",
			"mistral",
			"phi3",
		],
		requiresKey: false,
		baseUrl: "http://localhost:11434",
		fetchModels: async (_key, baseUrl) => {
			const res = await fetch(
				`${baseUrl || "http://localhost:11434"}/api/tags`,
			);
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			return (data.models as { name: string }[]).map((m) => m.name);
		},
	},
];

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id);

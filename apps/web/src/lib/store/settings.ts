"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderId } from "@/lib/agent/types";

export type ProviderConfig = {
	key: string;
	model: string;
	url: string;
};

type SettingsState = {
	providers: Record<ProviderId, ProviderConfig>;
	activeProvider: ProviderId;
	setProviderConfig: (id: ProviderId, config: Partial<ProviderConfig>) => void;
	setActiveProvider: (id: ProviderId) => void;
	getActiveConfig: () => ProviderConfig;
};

const defaults: Record<ProviderId, ProviderConfig> = {
	anthropic: { key: "", model: "claude-sonnet-4-6", url: "" },
	openai: { key: "", model: "gpt-5.2", url: "" },
	google: { key: "", model: "gemini-2.5-pro", url: "" },
	mistral: { key: "", model: "mistral-large-3-25-12", url: "" },
	groq: { key: "", model: "llama-3.3-70b-versatile", url: "" },
	xai: { key: "", model: "grok-4-0709", url: "" },
	cohere: { key: "", model: "command-a-03-2025", url: "" },
	perplexity: { key: "", model: "sonar-pro", url: "" },
	deepseek: { key: "", model: "deepseek-chat", url: "" },
	together: {
		key: "",
		model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
		url: "",
	},
	openrouter: { key: "", model: "openrouter/auto", url: "" },
	fireworks: {
		key: "",
		model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
		url: "",
	},
	cerebras: { key: "", model: "gpt-oss-120b", url: "" },
	azure: { key: "", model: "gpt-4o", url: "" },
	huggingface: {
		key: "",
		model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
		url: "",
	},
	ai21: { key: "", model: "jamba-large", url: "" },
	ollama: { key: "", model: "llama3.1", url: "http://localhost:11434" },
};

export const useSettings = create<SettingsState>()(
	persist(
		(set, get) => ({
			providers: defaults,
			activeProvider: "anthropic",

			setProviderConfig: (id, config) => {
				set((s) => ({
					providers: {
						...s.providers,
						[id]: { ...s.providers[id], ...config },
					},
				}));
			},

			setActiveProvider: (id) => set({ activeProvider: id }),

			getActiveConfig: () => {
				const { providers, activeProvider } = get();
				return providers[activeProvider];
			},
		}),
		{ name: "deimos-settings" },
	),
);

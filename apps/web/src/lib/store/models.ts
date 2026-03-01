"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderId } from "@/lib/agent/types";

export type ModelEntry = {
	id: string;
	label: string;
	provider: ProviderId;
};

type ModelsState = {
	models: ModelEntry[];
	selectedId: string | null;
	select: (id: string) => void;
	getSelected: () => ModelEntry;
	add: (entry: ModelEntry) => void;
	remove: (id: string) => void;
	update: (id: string, entry: Partial<Omit<ModelEntry, "id">>) => void;
	reorder: (from: number, to: number) => void;
};

export const DEFAULTS: ModelEntry[] = [
	{
		id: "claude-sonnet-4-6",
		label: "Claude Sonnet 4.6",
		provider: "anthropic",
	},
	{ id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
	{ id: "gpt-4o", label: "GPT-4o", provider: "openai" },
	{ id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
	{ id: "qwen2.5:7b", label: "Qwen 2.5 7B", provider: "ollama" },
	{ id: "llama3.2", label: "Llama 3.2", provider: "ollama" },
];

export const useModels = create<ModelsState>()(
	persist(
		(set, get) => ({
			models: DEFAULTS,
			selectedId: "claude-opus-4-6",

			select: (id) => set({ selectedId: id }),

			getSelected: () => {
				const { models, selectedId } = get();
				return models.find((m) => m.id === selectedId) ?? models[0];
			},

			add: (entry) =>
				set((s) => ({
					models: s.models.some((m) => m.id === entry.id)
						? s.models
						: [...s.models, entry],
				})),

			remove: (id) =>
				set((s) => ({
					models: s.models.filter((m) => m.id !== id),
					selectedId: s.selectedId === id ? null : s.selectedId,
				})),

			update: (id, patch) =>
				set((s) => ({
					models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
				})),

			reorder: (from, to) =>
				set((s) => {
					const arr = [...s.models];
					const [item] = arr.splice(from, 1);
					arr.splice(to, 0, item);
					return { models: arr };
				}),
		}),
		{ name: "deimos-models" },
	),
);

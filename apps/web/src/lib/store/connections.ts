"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ConnectionEntry = {
	id: string;
	addedAt: number;
	lastUsedAt: number;
};

export type CustomConnectionDef = {
	id: string;
	name: string;
	category: string;
	iconUrl?: string;
};

type ConnectionsState = {
	active: ConnectionEntry[];
	customDefs: CustomConnectionDef[];
	add: (id: string) => void;
	addMany: (ids: string[]) => void;
	remove: (id: string) => void;
	removeMany: (ids: string[]) => void;
	touch: (id: string) => void;
	has: (id: string) => boolean;
	addCustomDef: (def: Omit<CustomConnectionDef, "id">) => void;
	removeCustomDef: (id: string) => void;
	updateCustomDef: (
		id: string,
		patch: Partial<Omit<CustomConnectionDef, "id">>,
	) => void;
};

export const useConnections = create<ConnectionsState>()(
	persist(
		(set, get) => ({
			active: [],
			customDefs: [],

			add: (id) => {
				if (get().active.some((c) => c.id === id)) return;
				const now = Date.now();
				set((s) => ({
					active: [...s.active, { id, addedAt: now, lastUsedAt: now }],
				}));
			},

			addMany: (ids) => {
				const now = Date.now();
				set((s) => {
					const existingIds = new Set(s.active.map((c) => c.id));
					const toAdd = ids.filter((id) => !existingIds.has(id));
					return {
						active: [
							...s.active,
							...toAdd.map((id) => ({ id, addedAt: now, lastUsedAt: now })),
						],
					};
				});
			},

			remove: (id) =>
				set((s) => ({ active: s.active.filter((c) => c.id !== id) })),

			removeMany: (ids) => {
				const idSet = new Set(ids);
				set((s) => ({ active: s.active.filter((c) => !idSet.has(c.id)) }));
			},

			touch: (id) => {
				const now = Date.now();
				set((s) => ({
					active: [
						...s.active.filter((c) => c.id !== id),
						// biome-ignore lint/style/noNonNullAssertion: id is validated before this call
						{ ...s.active.find((c) => c.id === id)!, lastUsedAt: now },
					],
				}));
			},

			has: (id) => get().active.some((c) => c.id === id),

			addCustomDef: (def) => {
				const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
				set((s) => ({ customDefs: [...s.customDefs, { ...def, id }] }));
			},

			removeCustomDef: (id) =>
				set((s) => ({
					customDefs: s.customDefs.filter((d) => d.id !== id),
					active: s.active.filter((c) => c.id !== id),
				})),

			updateCustomDef: (id, patch) =>
				set((s) => ({
					customDefs: s.customDefs.map((d) =>
						d.id === id ? { ...d, ...patch } : d,
					),
				})),
		}),
		{ name: "deimos-connections" },
	),
);

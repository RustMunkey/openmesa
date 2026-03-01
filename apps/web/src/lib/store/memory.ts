"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MemoryItem } from "@/lib/agent/types";

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type MemoryState = {
	pins: MemoryItem[];
	notes: string;
	pin: (content: string, source?: MemoryItem["source"]) => void;
	unpin: (id: string) => void;
	updateNotes: (notes: string) => void;
	clear: () => void;
};

export const useMemory = create<MemoryState>()(
	persist(
		(set) => ({
			pins: [],
			notes: "",

			pin: (content, source = "pinned") => {
				const item: MemoryItem = {
					id: genId(),
					content,
					source,
					pinnedAt: Date.now(),
				};
				set((s) => ({ pins: [item, ...s.pins] }));
			},

			unpin: (id) => set((s) => ({ pins: s.pins.filter((p) => p.id !== id) })),

			updateNotes: (notes) => set({ notes }),

			clear: () => set({ pins: [], notes: "" }),
		}),
		{ name: "deimos-memory" },
	),
);

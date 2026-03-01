"use client";

import { create } from "zustand";

type GhostState = {
	active: boolean;
	toggle: () => void;
	setActive: (active: boolean) => void;
};

function applyGhost(active: boolean) {
	if (typeof document === "undefined") return;
	if (active) {
		document.documentElement.setAttribute("data-ghost", "");
	} else {
		document.documentElement.removeAttribute("data-ghost");
	}
}

export const useGhost = create<GhostState>()((set) => ({
	active: false,
	toggle: () =>
		set((s) => {
			const next = !s.active;
			applyGhost(next);
			return { active: next };
		}),
	setActive: (active) => {
		applyGhost(active);
		set({ active });
	},
}));

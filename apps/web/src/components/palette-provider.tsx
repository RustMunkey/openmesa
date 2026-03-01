"use client";

import { useEffect } from "react";

export function PaletteProvider() {
	useEffect(() => {
		const saved = localStorage.getItem("deimos-palette") ?? "mars";
		document.documentElement.setAttribute("data-palette", saved);
	}, []);
	return null;
}

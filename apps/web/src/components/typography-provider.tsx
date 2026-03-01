"use client";

import { useEffect } from "react";

export function TypographyProvider() {
	useEffect(() => {
		const saved = localStorage.getItem("deimos-typography") ?? "mono";
		document.documentElement.setAttribute("data-font", saved);
	}, []);
	return null;
}

"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversations } from "@/lib/store/conversations";
import { useModels } from "@/lib/store/models";
import { useSettings } from "@/lib/store/settings";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
	const { conversations } = useConversations();
	const { providers } = useSettings();
	const { models } = useModels();
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [typography, setTypography] = useState<"mono" | "sans" | "serif">(
		"mono",
	);
	const [palette, setPaletteState] = useState<"mars" | "deepspace" | "phobos">(
		"mars",
	);
	useEffect(() => {
		setMounted(true);
		const savedFont = localStorage.getItem("deimos-typography") as
			| "mono"
			| "sans"
			| "serif"
			| null;
		if (savedFont) setTypography(savedFont);
		const savedPalette = localStorage.getItem("deimos-palette") as
			| "mars"
			| "deepspace"
			| "phobos"
			| null;
		if (savedPalette) setPaletteState(savedPalette);
	}, []);

	const handlePalette = (p: "mars" | "deepspace" | "phobos") => {
		setPaletteState(p);
		localStorage.setItem("deimos-palette", p);
		document.documentElement.setAttribute("data-palette", p);
	};

	const handleTypography = (t: "mono" | "sans" | "serif") => {
		setTypography(t);
		localStorage.setItem("deimos-typography", t);
		document.documentElement.setAttribute("data-font", t);
	};

	const exportData = () => {
		const data = {
			exportedAt: new Date().toISOString(),
			conversations,
			providers,
			models,
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `deimos-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Data exported");
	};

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-base font-semibold">General</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Manage your account preferences.
				</p>
			</div>

			<div className="space-y-6">
				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Display Name</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Your name as shown in the app.
					</p>
					<Input type="text" placeholder="Your name" className="max-w-sm" />
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Palette</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Choose your color palette.
					</p>
					<div className="flex gap-2">
						{(["mars", "deepspace", "phobos"] as const).map((p) => (
							<Button
								key={p}
								variant="outline"
								onClick={() => handlePalette(p)}
								className={cn(
									"capitalize",
									mounted &&
										palette === p &&
										"border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
								)}
							>
								{p === "mars"
									? "Mars"
									: p === "deepspace"
										? "Deep Space"
										: "Phobos"}
							</Button>
						))}
					</div>
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Theme</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Choose your preferred appearance.
					</p>
					<div className="flex gap-2">
						{(["dark", "light", "system"] as const).map((t) => (
							<Button
								key={t}
								variant="outline"
								onClick={() => setTheme(t)}
								className={cn(
									"capitalize",
									mounted &&
										theme === t &&
										"border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
								)}
							>
								{t}
							</Button>
						))}
					</div>
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Typography</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Choose your preferred font style.
					</p>
					<div className="flex gap-2">
						{(["mono", "sans", "serif"] as const).map((t) => (
							<Button
								key={t}
								variant="outline"
								onClick={() => handleTypography(t)}
								className={cn(
									"capitalize",
									mounted &&
										typography === t &&
										"border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
								)}
							>
								{t}
							</Button>
						))}
					</div>
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Export Data</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Download all your conversations, settings, and models as a JSON
						file.
					</p>
					<Button variant="outline" onClick={exportData}>
						Export All Data
					</Button>
				</div>

				<div className="rounded-xl border border-destructive/30 p-4">
					<h3 className="text-sm font-medium text-destructive mb-1">
						Danger Zone
					</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Clear all local data including conversations, projects, and
						settings.
					</p>
					<Button variant="destructive">Reset All Data</Button>
				</div>
			</div>
		</div>
	);
}

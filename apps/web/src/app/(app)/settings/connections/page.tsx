"use client";

import {
	CheckIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ALL_CONNECTIONS,
	CATEGORIES,
	type ConnectionDef,
	ConnectionIcon,
} from "@/components/connections-dock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useConnections } from "@/lib/store/connections";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = [...CATEGORIES, "Custom"] as const;

export default function ConnectionsSettingsPage() {
	const {
		active,
		remove,
		add,
		has,
		customDefs,
		addCustomDef,
		removeCustomDef,
	} = useConnections();

	const [search, setSearch] = useState("");
	const [addingCustom, setAddingCustom] = useState(false);
	const [customName, setCustomName] = useState("");
	const [customCategory, setCustomCategory] = useState<string>("Custom");
	const [customIconUrl, setCustomIconUrl] = useState("");

	const allConns = useMemo<ConnectionDef[]>(
		() => [
			...ALL_CONNECTIONS,
			...customDefs.map((d) => ({ ...d, isCustom: true as const })),
		],
		[customDefs],
	);

	const connMap = useMemo(
		() => new Map(allConns.map((c) => [c.id, c])),
		[allConns],
	);

	const activeConnections = active
		.map((e) => connMap.get(e.id))
		.filter(Boolean) as ConnectionDef[];

	const filtered = search
		? allConns.filter((c) =>
				c.name.toLowerCase().includes(search.toLowerCase()),
			)
		: allConns;

	const grouped = ALL_CATEGORIES.map((cat) => ({
		category: cat,
		items: filtered.filter((c) => c.category === cat),
	})).filter((g) => g.items.length > 0);

	const handleAddCustom = () => {
		const name = customName.trim();
		if (!name) return;
		addCustomDef({
			name,
			category: customCategory,
			iconUrl: customIconUrl.trim() || undefined,
		});
		setCustomName("");
		setCustomIconUrl("");
		setCustomCategory("Custom");
		setAddingCustom(false);
		toast.success(`Added ${name}`);
	};

	const handleCancelCustom = () => {
		setAddingCustom(false);
		setCustomName("");
		setCustomIconUrl("");
		setCustomCategory("Custom");
	};

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-base font-semibold">Connections</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Manage active connections and add your own custom services.
				</p>
			</div>

			<div className="space-y-6">
				{/* ── Active Connections ─────────────────────────────────── */}
				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border flex items-center justify-between">
						<div>
							<h3 className="text-sm font-medium">Active Connections</h3>
							<p className="text-xs text-muted-foreground mt-0.5">
								{active.length === 0
									? "None connected"
									: `${active.length} connected`}
							</p>
						</div>
					</div>

					{activeConnections.length === 0 ? (
						<div className="px-4 py-8 text-center text-xs text-muted-foreground">
							No connections active yet. Browse below to get started.
						</div>
					) : (
						<div className="divide-y divide-border">
							{activeConnections.map((def) => (
								<div key={def.id} className="flex items-center gap-3 px-4 py-3">
									<ConnectionIcon def={def} size={20} />
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{def.name}</p>
										<p className="text-xs text-muted-foreground">
											{def.category}
										</p>
									</div>
									<button
										type="button"
										onClick={() => remove(def.id)}
										className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
									>
										<XIcon className="size-4" />
									</button>
								</div>
							))}
						</div>
					)}
				</div>

				{/* ── Custom Connections ──────────────────────────────────── */}
				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border flex items-center justify-between">
						<div>
							<h3 className="text-sm font-medium">Custom Connections</h3>
							<p className="text-xs text-muted-foreground mt-0.5">
								Add your own services — they'll appear alongside built-in
								connections.
							</p>
						</div>
						{!addingCustom && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAddingCustom(true)}
							>
								<PlusIcon className="size-3.5 mr-1.5" />
								Add
							</Button>
						)}
					</div>

					{addingCustom && (
						<div className="px-4 py-4 border-b border-border space-y-3">
							<div className="flex gap-2">
								<div className="flex-1 min-w-0">
									{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
									<label className="text-xs text-muted-foreground mb-1 block">
										Name
									</label>
									<Input
										value={customName}
										onChange={(e) => setCustomName(e.target.value)}
										placeholder="e.g. My Service"
										autoFocus
										onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
									/>
								</div>
								<div className="w-36 shrink-0">
									{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
									<label className="text-xs text-muted-foreground mb-1 block">
										Category
									</label>
									<Select
										value={customCategory}
										onValueChange={setCustomCategory}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ALL_CATEGORIES.map((c) => (
												<SelectItem key={c} value={c}>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div>
								{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
								<label className="text-xs text-muted-foreground mb-1 block">
									Icon URL{" "}
									<span className="text-muted-foreground/50">(optional)</span>
								</label>
								<Input
									value={customIconUrl}
									onChange={(e) => setCustomIconUrl(e.target.value)}
									placeholder="https://example.com/icon.svg"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									onClick={handleAddCustom}
									disabled={!customName.trim()}
								>
									Add Connection
								</Button>
								<Button size="sm" variant="ghost" onClick={handleCancelCustom}>
									Cancel
								</Button>
							</div>
						</div>
					)}

					{customDefs.length === 0 && !addingCustom ? (
						<div className="px-4 py-8 text-center text-xs text-muted-foreground">
							No custom connections yet.
						</div>
					) : customDefs.length > 0 ? (
						<div className="divide-y divide-border">
							{customDefs.map((def) => {
								const fullDef: ConnectionDef = { ...def, isCustom: true };
								const isActive = has(def.id);
								return (
									<div
										key={def.id}
										className="flex items-center gap-3 px-4 py-3"
									>
										<ConnectionIcon def={fullDef} size={20} />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">{def.name}</p>
											<p className="text-xs text-muted-foreground">
												{def.category}
											</p>
										</div>
										<div className="flex items-center gap-1.5 shrink-0">
											<button
												type="button"
												onClick={() =>
													isActive ? remove(def.id) : add(def.id)
												}
												className={cn(
													"flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
													isActive
														? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
														: "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
												)}
											>
												{isActive && <CheckIcon className="size-3" />}
												{isActive ? "Connected" : "Connect"}
											</button>
											<button
												type="button"
												onClick={() => removeCustomDef(def.id)}
												className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
											>
												<TrashIcon className="size-3.5" />
											</button>
										</div>
									</div>
								);
							})}
						</div>
					) : null}
				</div>

				{/* ── Browse All Connections ──────────────────────────────── */}
				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border">
						<h3 className="text-sm font-medium mb-2">Browse All Connections</h3>
						<div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
							<MagnifyingGlassIcon className="size-4 text-muted-foreground shrink-0" />
							<input
								type="text"
								placeholder="Search..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
							{search && (
								<button
									type="button"
									onClick={() => setSearch("")}
									className="text-muted-foreground hover:text-foreground transition-colors"
								>
									<XIcon className="size-3.5" />
								</button>
							)}
						</div>
					</div>

					<div className="divide-y divide-border max-h-[560px] overflow-y-auto">
						{grouped.length === 0 ? (
							<div className="px-4 py-8 text-center text-xs text-muted-foreground">
								No matches for &quot;{search}&quot;
							</div>
						) : (
							grouped.map((group) => (
								<div key={group.category}>
									<p className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 sticky top-0">
										{group.category}
									</p>
									{group.items.map((def) => {
										const isActive = has(def.id);
										return (
											<div
												key={def.id}
												className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
											>
												<ConnectionIcon def={def} size={18} />
												<span className="flex-1 text-sm">{def.name}</span>
												<button
													type="button"
													onClick={() =>
														isActive ? remove(def.id) : add(def.id)
													}
													className={cn(
														"flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer",
														isActive
															? "text-primary hover:text-destructive hover:bg-destructive/10"
															: "text-muted-foreground hover:text-foreground hover:bg-muted",
													)}
												>
													{isActive ? (
														<CheckIcon className="size-4" />
													) : (
														<PlusIcon className="size-4" />
													)}
												</button>
											</div>
										);
									})}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

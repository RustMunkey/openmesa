"use client";

import { faCommentSms } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	CheckIcon,
	MagnifyingGlassIcon,
	PencilSimpleIcon,
	PlugIcon,
	PlusIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConnections } from "@/lib/store/connections";
import { useGhost } from "@/lib/store/ghost";
import { cn } from "@/lib/utils";

export type ConnectionDef = {
	id: string;
	name: string;
	category: string;
	iconOverride?: "sms" | "apple";
	iconUrl?: string;
	isCustom?: boolean;
};

export const CATEGORIES = [
	"Communication",
	"Productivity",
	"Dev Tools",
	"AI",
	"Smart Home",
	"Media & Social",
	"Finance",
	"Email & CRM",
	"Storage",
] as const;

export const ALL_CONNECTIONS: ConnectionDef[] = [
	// Communication
	{ id: "gmail", name: "Gmail", category: "Communication" },
	{ id: "imessage", name: "iMessage", category: "Communication" },
	{
		id: "android-messages",
		name: "Messages (Android)",
		category: "Communication",
	},
	{ id: "sms", name: "SMS", category: "Communication", iconOverride: "sms" },
	{ id: "slack", name: "Slack", category: "Communication" },
	{ id: "discord", name: "Discord", category: "Communication" },
	{ id: "whatsapp", name: "WhatsApp", category: "Communication" },
	{ id: "telegram", name: "Telegram", category: "Communication" },
	{ id: "signal", name: "Signal", category: "Communication" },
	{ id: "teams", name: "Microsoft Teams", category: "Communication" },
	{ id: "google-chat", name: "Google Chat", category: "Communication" },
	{ id: "messenger", name: "Messenger", category: "Communication" },
	{ id: "linkedin", name: "LinkedIn", category: "Communication" },

	// Productivity
	{ id: "notion", name: "Notion", category: "Productivity" },
	{ id: "obsidian", name: "Obsidian", category: "Productivity" },
	{ id: "linear", name: "Linear", category: "Productivity" },
	{ id: "google-calendar", name: "Google Calendar", category: "Productivity" },
	{ id: "google-drive", name: "Google Drive", category: "Productivity" },
	{ id: "google-docs", name: "Google Docs", category: "Productivity" },
	{ id: "google-sheets", name: "Google Sheets", category: "Productivity" },
	{ id: "todoist", name: "Todoist", category: "Productivity" },
	{
		id: "apple-notes",
		name: "Apple Notes",
		category: "Productivity",
		iconOverride: "apple",
	},
	{
		id: "apple-reminders",
		name: "Apple Reminders",
		category: "Productivity",
		iconOverride: "apple",
	},
	{ id: "airtable", name: "Airtable", category: "Productivity" },
	{ id: "figma", name: "Figma", category: "Productivity" },
	{ id: "jira", name: "Jira", category: "Productivity" },
	{ id: "trello", name: "Trello", category: "Productivity" },
	{ id: "asana", name: "Asana", category: "Productivity" },

	// Dev Tools
	{ id: "github", name: "GitHub", category: "Dev Tools" },
	{ id: "gitlab", name: "GitLab", category: "Dev Tools" },
	{ id: "bitbucket", name: "Bitbucket", category: "Dev Tools" },
	{ id: "vercel", name: "Vercel", category: "Dev Tools" },
	{ id: "netlify", name: "Netlify", category: "Dev Tools" },
	{ id: "supabase", name: "Supabase", category: "Dev Tools" },
	{ id: "firebase", name: "Firebase", category: "Dev Tools" },
	{ id: "aws", name: "AWS", category: "Dev Tools" },
	{ id: "docker", name: "Docker", category: "Dev Tools" },
	{ id: "sentry", name: "Sentry", category: "Dev Tools" },
	{ id: "neon", name: "Neon", category: "Dev Tools" },
	{ id: "browser", name: "Browser", category: "Dev Tools" },

	// AI
	{ id: "chatgpt", name: "ChatGPT", category: "AI" },
	{ id: "claude", name: "Claude", category: "AI" },
	{ id: "gemini", name: "Gemini", category: "AI" },
	{ id: "grok", name: "Grok", category: "AI" },
	{ id: "perplexity", name: "Perplexity", category: "AI" },
	{ id: "mistral", name: "Mistral", category: "AI" },
	{ id: "cohere", name: "Cohere", category: "AI" },
	{ id: "replicate", name: "Replicate", category: "AI" },
	{ id: "huggingface", name: "HuggingFace", category: "AI" },
	{ id: "elevenlabs", name: "ElevenLabs", category: "AI" },

	// Smart Home
	{ id: "hue", name: "Philips Hue", category: "Smart Home" },
	{
		id: "homekit",
		name: "HomeKit",
		category: "Smart Home",
		iconOverride: "apple",
	},
	{ id: "google-home", name: "Google Home", category: "Smart Home" },
	{ id: "home-assistant", name: "Home Assistant", category: "Smart Home" },
	{ id: "ifttt", name: "IFTTT", category: "Smart Home" },

	// Media & Social
	{ id: "x-twitter", name: "X / Twitter", category: "Media & Social" },
	{ id: "spotify", name: "Spotify", category: "Media & Social" },
	{ id: "youtube", name: "YouTube", category: "Media & Social" },
	{ id: "twitch", name: "Twitch", category: "Media & Social" },
	{ id: "instagram", name: "Instagram", category: "Media & Social" },
	{ id: "tiktok", name: "TikTok", category: "Media & Social" },
	{ id: "reddit", name: "Reddit", category: "Media & Social" },
	{ id: "apple-music", name: "Apple Music", category: "Media & Social" },

	// Finance
	{ id: "stripe", name: "Stripe", category: "Finance" },
	{ id: "paypal", name: "PayPal", category: "Finance" },
	{ id: "coinbase", name: "Coinbase", category: "Finance" },
	{ id: "polar", name: "Polar", category: "Finance" },

	// Email & CRM
	{ id: "outlook", name: "Outlook", category: "Email & CRM" },
	{ id: "protonmail", name: "ProtonMail", category: "Email & CRM" },
	{ id: "resend", name: "Resend", category: "Email & CRM" },
	{ id: "hubspot", name: "HubSpot", category: "Email & CRM" },

	// Storage
	{ id: "dropbox", name: "Dropbox", category: "Storage" },
	{ id: "icloud", name: "iCloud", category: "Storage" },
	{ id: "onedrive", name: "OneDrive", category: "Storage" },
];

function getIconSrc(def: ConnectionDef): string | null {
	if (def.isCustom) return def.iconUrl ?? null;
	if (def.iconOverride === "apple") return "/icons/connections/apple.svg";
	if (def.iconOverride === "sms") return null;
	return `/icons/connections/${def.id}.svg`;
}

export function ConnectionIcon({
	def,
	size = 14,
}: {
	def: ConnectionDef;
	size?: number;
}) {
	if (def.iconOverride === "sms") {
		return (
			<FontAwesomeIcon
				icon={faCommentSms}
				style={{ width: size, height: size }}
				className="text-foreground/60"
			/>
		);
	}
	if (def.isCustom && !def.iconUrl) {
		return (
			<PlugIcon
				style={{ width: size, height: size }}
				className="text-foreground/60"
			/>
		);
	}
	const src = getIconSrc(def);
	if (!src)
		return (
			<PlugIcon
				style={{ width: size, height: size }}
				className="text-foreground/60"
			/>
		);
	return (
		<Image
			src={src}
			alt={def.name}
			width={size}
			height={size}
			style={{ width: size, height: size }}
			className="opacity-80"
		/>
	);
}

function DockIconInner({ def }: { def: ConnectionDef }) {
	if (def.iconOverride === "sms") {
		return (
			<FontAwesomeIcon
				icon={faCommentSms}
				className="size-[18px] text-sidebar-foreground/50 transition-colors duration-200 group-hover/dock-item:text-sidebar-foreground"
			/>
		);
	}
	if (def.isCustom && !def.iconUrl) {
		return (
			<PlugIcon className="size-5 text-sidebar-foreground/50 transition-colors duration-200 group-hover/dock-item:text-sidebar-foreground" />
		);
	}
	const src = getIconSrc(def);
	if (!src)
		return (
			<PlugIcon className="size-5 text-sidebar-foreground/50 transition-colors duration-200 group-hover/dock-item:text-sidebar-foreground" />
		);
	return (
		<Image
			src={src}
			alt={def.name}
			width={20}
			height={20}
			className="size-5 opacity-50 transition-opacity duration-200 group-hover/dock-item:opacity-100"
		/>
	);
}

function DockItem({
	def,
	onRemove,
	managing,
	selected,
	onToggleSelect,
}: {
	def: ConnectionDef;
	onRemove: () => void;
	managing: boolean;
	selected: boolean;
	onToggleSelect: () => void;
}) {
	if (managing) {
		return (
			<button
				type="button"
				onClick={onToggleSelect}
				className={cn(
					"relative flex size-10 items-center justify-center rounded-lg cursor-pointer outline-none transition-all",
					selected
						? "bg-primary/15 ring-1 ring-primary/40"
						: "hover:bg-muted/30",
				)}
			>
				<DockIconInner def={def} />
				{selected && (
					<div className="absolute bottom-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary">
						<CheckIcon
							className="size-2.5 text-primary-foreground"
							weight="bold"
						/>
					</div>
				)}
			</button>
		);
	}

	return (
		<div className="group/dock-item relative">
			{/* Quick-remove X — shown on hover, 1 click */}
			<button
				type="button"
				onClick={onRemove}
				className="absolute top-0.5 right-0.5 z-10 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/dock-item:flex"
			>
				<XIcon className="size-2.5" weight="bold" />
			</button>

			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex size-10 items-center justify-center outline-none cursor-pointer"
							>
								<DockIconInner def={def} />
							</button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent side="left" align="center">
						{def.name}
					</TooltipContent>
				</Tooltip>
				<DropdownMenuContent side="left" align="end" className="min-w-40">
					<DropdownMenuItem disabled>
						<span className="text-xs text-muted-foreground">
							Configure {def.name}...
						</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={onRemove}>
						<TrashIcon />
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function AddConnectionPicker({ allConns }: { allConns: ConnectionDef[] }) {
	const { addMany, active } = useConnections();
	const [search, setSearch] = useState("");
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState<Set<string>>(new Set());

	const activeIds = new Set(active.map((c) => c.id));
	const available = allConns.filter((c) => !activeIds.has(c.id));
	const filtered = search
		? available.filter((c) =>
				c.name.toLowerCase().includes(search.toLowerCase()),
			)
		: available;

	const allCats = [...CATEGORIES, "Custom"] as const;
	const grouped = allCats
		.map((cat) => ({
			category: cat,
			items: filtered.filter((c) => c.category === cat),
		}))
		.filter((g) => g.items.length > 0);

	const toggle = (id: string) => {
		setPending((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleAdd = () => {
		if (pending.size === 0) return;
		addMany(Array.from(pending));
		setPending(new Set());
		setOpen(false);
		setSearch("");
	};

	const handleOpenChange = (v: boolean) => {
		if (!v) {
			setOpen(false);
			setSearch("");
			setPending(new Set());
		} else {
			setOpen(true);
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="flex size-10 items-center justify-center outline-none cursor-pointer text-muted-foreground hover:text-accent-foreground transition-colors"
						>
							<PlusIcon className="size-[22px]" />
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="left" align="center">
					Add connection
				</TooltipContent>
			</Tooltip>

			<PopoverContent
				side="left"
				align="end"
				sideOffset={4}
				className="w-80 p-0 flex flex-col overflow-hidden"
				style={{ maxHeight: "min(480px, calc(100vh - 48px))" }}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				{/* Search */}
				<div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
					<MagnifyingGlassIcon className="size-4 text-muted-foreground shrink-0" />
					<input
						type="text"
						placeholder="Search connections..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					/>
					{pending.size > 0 && (
						<button
							type="button"
							onClick={() => setPending(new Set())}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							Clear
						</button>
					)}
				</div>

				{/* List */}
				<div className="overflow-y-auto flex-1">
					{grouped.length === 0 ? (
						<p className="px-3 py-6 text-center text-xs text-muted-foreground">
							{available.length === 0 ? "All connections added" : "No matches"}
						</p>
					) : (
						<div className="py-1">
							{grouped.map((group, i) => (
								<div key={group.category}>
									{i > 0 && <div className="my-0.5 mx-2 h-px bg-border" />}
									<p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
										{group.category}
									</p>
									{group.items.map((c) => {
										const checked = pending.has(c.id);
										return (
											<button
												key={c.id}
												type="button"
												onClick={() => toggle(c.id)}
												className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
											>
												<div
													className={cn(
														"flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
														checked
															? "bg-primary border-primary"
															: "border-border",
													)}
												>
													{checked && (
														<CheckIcon
															className="size-2.5 text-primary-foreground"
															weight="bold"
														/>
													)}
												</div>
												<ConnectionIcon def={c} size={14} />
												<span className="flex-1 truncate">{c.name}</span>
											</button>
										);
									})}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="shrink-0 border-t border-border p-2">
					<Button
						size="sm"
						className="w-full"
						disabled={pending.size === 0}
						onClick={handleAdd}
					>
						{pending.size === 0
							? "Select connections to add"
							: `Add ${pending.size} connection${pending.size === 1 ? "" : "s"}`}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function ConnectionsDock() {
	const { active, remove, removeMany, customDefs } = useConnections();
	const ghostActive = useGhost((s) => s.active);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [managing, setManaging] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const allConns = useMemo(
		() => [
			...ALL_CONNECTIONS,
			...customDefs.map((d) => ({ ...d, isCustom: true as const })),
		],
		[customDefs],
	);

	const dynConnectionMap = useMemo(
		() => new Map(allConns.map((c) => [c.id, c])),
		[allConns],
	);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, []);

	const activeConnections = active
		.map((entry) => dynConnectionMap.get(entry.id))
		.filter(Boolean) as ConnectionDef[];

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleDeleteSelected = () => {
		removeMany(Array.from(selectedIds));
		setSelectedIds(new Set());
		setManaging(false);
	};

	const handleDoneManaging = () => {
		setManaging(false);
		setSelectedIds(new Set());
	};

	return (
		<div className="hidden md:block text-sidebar-foreground">
			<div className="w-[calc(var(--sidebar-width-icon)+(--spacing(4)))] bg-transparent shrink-0" />

			<div className="fixed inset-y-0 right-0 z-10 flex h-svh w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)] p-2">
				<div className={`flex size-full flex-col bg-sidebar`}>
					{/* Scrollable icon list */}
					<div
						ref={scrollRef}
						className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-2 transition-opacity duration-500 ease-out ${
							ghostActive ? "opacity-0 pointer-events-none" : "opacity-100"
						}`}
					>
						<div className="flex flex-col items-center gap-1">
							{activeConnections.map((def) => (
								<DockItem
									key={def.id}
									def={def}
									onRemove={() => remove(def.id)}
									managing={managing}
									selected={selectedIds.has(def.id)}
									onToggleSelect={() => toggleSelect(def.id)}
								/>
							))}
						</div>
					</div>

					{/* Footer actions */}
					<div
						className={`flex flex-col items-center gap-0.5 py-2 transition-opacity duration-500 ease-out ${
							ghostActive ? "opacity-0 pointer-events-none" : "opacity-100"
						}`}
					>
						{managing ? (
							<>
								{selectedIds.size > 0 && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={handleDeleteSelected}
												className="flex size-10 items-center justify-center outline-none cursor-pointer text-destructive hover:text-destructive/70 transition-colors"
											>
												<TrashIcon className="size-[20px]" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="left">
											Delete {selectedIds.size} selected
										</TooltipContent>
									</Tooltip>
								)}
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={handleDoneManaging}
											className="flex size-10 items-center justify-center outline-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
										>
											<CheckIcon className="size-[20px]" />
										</button>
									</TooltipTrigger>
									<TooltipContent side="left">Done</TooltipContent>
								</Tooltip>
							</>
						) : (
							<>
								{activeConnections.length > 0 && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => setManaging(true)}
												className="flex size-10 items-center justify-center outline-none cursor-pointer text-muted-foreground hover:text-accent-foreground transition-colors"
											>
												<PencilSimpleIcon className="size-[18px]" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="left">
											Manage connections
										</TooltipContent>
									</Tooltip>
								)}
								<AddConnectionPicker allConns={allConns} />
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

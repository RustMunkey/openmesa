"use client";

import {
	ChatCircleIcon,
	CheckIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SortAscendingIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversations } from "@/lib/store/conversations";

type SortBy = "updated" | "created" | "name";
type Filter = "all" | "today" | "week" | "month";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
	{ value: "updated", label: "Last updated" },
	{ value: "created", label: "Date created" },
	{ value: "name", label: "Name" },
];

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "month", label: "This month" },
];

export default function HistoryPage() {
	const router = useRouter();
	const { conversations, removeConversation, setActive } = useConversations();
	const [search, setSearch] = useState("");
	const [sortBy, setSortBy] = useState<SortBy>("updated");
	const [filter, setFilter] = useState<Filter>("all");
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		let result = conversations.filter((c) =>
			c.title.toLowerCase().includes(search.toLowerCase()),
		);

		if (filter !== "all") {
			const now = Date.now();
			const cutoff =
				filter === "today"
					? now - 86400000
					: filter === "week"
						? now - 604800000
						: now - 2592000000;
			result = result.filter((c) => c.updatedAt >= cutoff);
		}

		result.sort((a, b) => {
			if (sortBy === "name") return a.title.localeCompare(b.title);
			if (sortBy === "created") return b.createdAt - a.createdAt;
			return b.updatedAt - a.updatedAt;
		});

		return result;
	}, [conversations, search, sortBy, filter]);

	const handleNewChat = () => {
		setActive(null);
		router.push("/chat");
	};

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<div className="mb-4 md:mb-6 flex items-center justify-between">
					<h1 className="text-xl font-semibold">History</h1>
					<Button size="default" onClick={handleNewChat}>
						<PlusIcon className="size-4" data-icon="inline-start" />
						<span className="hidden sm:inline">New Chat</span>
						<span className="sm:hidden">New</span>
					</Button>
				</div>

				<div className="mb-4 flex items-center gap-2">
					<div className="relative flex-1 min-w-0">
						<MagnifyingGlassIcon className="absolute start-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search conversations..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-10 w-full rounded-xl border border-border bg-background ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
						/>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="default"
								className="gap-1.5 text-muted-foreground shrink-0"
							>
								<SortAscendingIcon className="size-4" />
								<span className="hidden sm:inline">
									{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-40">
							{SORT_OPTIONS.map((o) => (
								<DropdownMenuItem
									key={o.value}
									onSelect={() => setSortBy(o.value)}
								>
									<span className="flex-1">{o.label}</span>
									{sortBy === o.value && <CheckIcon className="size-4" />}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="default"
								className="gap-1.5 text-muted-foreground shrink-0"
							>
								<FunnelIcon className="size-4" />
								<span className="hidden sm:inline">
									{FILTER_OPTIONS.find((o) => o.value === filter)?.label}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-36">
							{FILTER_OPTIONS.map((o) => (
								<DropdownMenuItem
									key={o.value}
									onSelect={() => setFilter(o.value)}
								>
									<span className="flex-1">{o.label}</span>
									{filter === o.value && <CheckIcon className="size-4" />}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{filtered.length === 0 ? (
					<div className="py-16 text-center text-sm text-muted-foreground">
						{conversations.length === 0
							? "No conversations yet. Start a chat to see it here."
							: "No conversations match your search."}
					</div>
				) : (
					<div className="space-y-1">
						{filtered.map((conv) => (
							<Link
								key={conv.id}
								href={`/chat/${conv.id}`}
								className="group flex items-center gap-4 rounded-xl px-4 py-3.5 hover:bg-muted/50"
							>
								<ChatCircleIcon className="size-5 shrink-0 text-muted-foreground" />
								<div className="flex-1 min-w-0">
									<p className="truncate text-sm font-medium">{conv.title}</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{conv.messages.length} message
										{conv.messages.length !== 1 ? "s" : ""} ·{" "}
										{new Date(conv.updatedAt).toLocaleDateString()}
									</p>
								</div>
								<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-destructive"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDeleteId(conv.id);
										}}
										title="Delete"
									>
										<TrashIcon className="size-4" />
									</Button>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>

			<AlertDialog
				open={!!deleteId}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete conversation?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this conversation and all its
							messages.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (deleteId) removeConversation(deleteId);
								setDeleteId(null);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

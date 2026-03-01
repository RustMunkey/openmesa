"use client";

import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChatCircleIcon,
	CircleIcon,
	FloppyDiskIcon,
	FolderIcon,
	LightningIcon,
} from "@phosphor-icons/react";
import { useConversations } from "@/lib/store/conversations";
import { useModels } from "@/lib/store/models";
import { useProjects } from "@/lib/store/projects";

function StatCard({
	label,
	value,
	sub,
	icon: Icon,
	trend,
}: {
	label: string;
	value: string | number;
	sub?: string;
	icon: typeof ChatCircleIcon;
	trend?: "up" | "down" | "neutral";
}) {
	return (
		<div className="rounded-2xl border border-border p-4 flex items-center gap-3">
			<div className="flex size-9 items-center justify-center rounded-xl bg-muted/50 shrink-0">
				<Icon className="size-4 text-muted-foreground" />
			</div>
			<div className="flex-1 min-w-0">
				<span className="text-[11px] text-muted-foreground">{label}</span>
				<div className="flex items-end gap-2">
					<span className="text-xl font-semibold font-heading leading-tight truncate">
						{value}
					</span>
					{trend && (
						<span
							className={`flex items-center gap-0.5 text-xs mb-0.5 shrink-0 ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}
						>
							{trend === "up" && <ArrowUpIcon className="size-3" />}
							{trend === "down" && <ArrowDownIcon className="size-3" />}
							{trend === "neutral" && (
								<CircleIcon className="size-2.5" weight="fill" />
							)}
							{sub}
						</span>
					)}
				</div>
				{!trend && sub && (
					<p className="text-xs text-muted-foreground truncate">{sub}</p>
				)}
			</div>
		</div>
	);
}

const HEAT_COLORS = [
	"bg-border", // 0 — empty
	"bg-primary/20", // 1 — low
	"bg-primary/40", // 2 — medium-low
	"bg-primary/65", // 3 — medium
	"bg-primary", // 4 — high
];

function ActivityDot({ level }: { level: number }) {
	return <div className={`size-[9px] rounded-full ${HEAT_COLORS[level]}`} />;
}

function ActivityGrid() {
	const weeks = 52;
	const days = 7;
	const grid: number[][] = [];
	for (let w = 0; w < weeks; w++) {
		const week: number[] = [];
		for (let d = 0; d < days; d++) {
			const r = Math.random();
			week.push(r < 0.35 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4);
		}
		grid.push(week);
	}

	return (
		<div className="flex gap-[3px]">
			{grid.map((week, wi) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size grid, indices are stable
				<div key={wi} className="flex flex-col gap-[3px] shrink-0">
					{week.map((level, di) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size grid, indices are stable
						<ActivityDot key={di} level={level} />
					))}
				</div>
			))}
		</div>
	);
}

function RecentChat({
	title,
	time,
	messageCount,
}: {
	title: string;
	time: string;
	messageCount: number;
}) {
	return (
		<div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
			<div className="flex items-center gap-3 min-w-0">
				<ChatCircleIcon className="size-4 text-muted-foreground shrink-0" />
				<span className="text-sm truncate">{title}</span>
			</div>
			<div className="flex items-center gap-3 shrink-0">
				<span className="text-xs text-muted-foreground">
					{messageCount} msgs
				</span>
				<span className="text-xs text-muted-foreground hidden sm:inline">
					{time}
				</span>
			</div>
		</div>
	);
}

function timeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export default function OverviewPage() {
	const { conversations } = useConversations();
	const { projects } = useProjects();
	const { models, selectedId } = useModels();
	const model = models.find((m) => m.id === selectedId) ?? models[0];

	const totalMessages = conversations.reduce(
		(acc, c) => acc + c.messages.length,
		0,
	);
	const activeProjects = projects.filter((p) => !p.archived).length;
	const recentChats = conversations.slice(0, 5);

	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const todayConversations = conversations.filter(
		(c) => c.createdAt >= todayStart.getTime(),
	);

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<h1 className="text-xl font-semibold mb-4 md:mb-6">Overview</h1>

				{/* Stats grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 md:mb-4">
					<StatCard
						label="Conversations"
						value={conversations.length}
						sub={`${todayConversations.length} today`}
						icon={ChatCircleIcon}
						trend={todayConversations.length > 0 ? "up" : "neutral"}
					/>
					<StatCard
						label="Messages"
						value={totalMessages}
						sub="all time"
						icon={LightningIcon}
					/>
					<StatCard
						label="Projects"
						value={activeProjects}
						sub={`${projects.filter((p) => p.archived).length} archived`}
						icon={FolderIcon}
					/>
					<StatCard
						label="Active Model"
						value={model?.label ?? "—"}
						sub={model?.provider ?? "none"}
						icon={FloppyDiskIcon}
					/>
				</div>

				{/* Activity heatmap — fits to grid width, scrollable on mobile */}
				<div className="overflow-x-auto no-scrollbar mb-3 md:mb-4">
					<div className="rounded-2xl border border-border p-4 w-fit min-w-full">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium">Activity</h2>
							<span className="text-xs text-muted-foreground">
								Last 52 weeks
							</span>
						</div>
						<ActivityGrid />
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
					{/* Recent conversations */}
					<div className="lg:col-span-2 rounded-2xl border border-border p-4">
						<h2 className="text-sm font-medium mb-3">Recent Conversations</h2>
						{recentChats.length === 0 ? (
							<p className="text-xs text-muted-foreground py-4 text-center">
								No conversations yet. Start a new chat.
							</p>
						) : (
							<div>
								{recentChats.map((c) => (
									<RecentChat
										key={c.id}
										title={c.title}
										time={timeAgo(c.updatedAt)}
										messageCount={c.messages.length}
									/>
								))}
							</div>
						)}
					</div>

					{/* Quick info */}
					<div className="rounded-2xl border border-border p-4 space-y-3">
						<h2 className="text-sm font-medium">Quick Info</h2>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Avg messages/chat</span>
								<span>
									{conversations.length > 0
										? Math.round(totalMessages / conversations.length)
										: 0}
								</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Agents deployed</span>
								<span>0</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Workflows</span>
								<span>0</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">
									Providers connected
								</span>
								<span>1</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

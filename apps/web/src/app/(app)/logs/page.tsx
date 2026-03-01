"use client";

import {
	ArrowClockwiseIcon,
	CheckIcon,
	FunnelIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LogLevel = "all" | "info" | "warn" | "error";

type LogEntry = {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error";
	source: string;
	message: string;
};

const MOCK_LOGS: LogEntry[] = [
	{
		id: "1",
		timestamp: "2026-02-26T00:12:34Z",
		level: "info",
		source: "orchestrator",
		message: "Server started on port 8787",
	},
	{
		id: "2",
		timestamp: "2026-02-26T00:12:35Z",
		level: "info",
		source: "database",
		message: "Connected to PostgreSQL on port 5433",
	},
	{
		id: "3",
		timestamp: "2026-02-26T00:13:01Z",
		level: "info",
		source: "provider",
		message: "Ollama provider initialized (qwen2.5:7b)",
	},
	{
		id: "4",
		timestamp: "2026-02-26T00:15:22Z",
		level: "warn",
		source: "provider",
		message: "Anthropic API key not configured — provider disabled",
	},
	{
		id: "5",
		timestamp: "2026-02-26T00:18:44Z",
		level: "error",
		source: "chat",
		message:
			"Failed to generate response: Connection refused (localhost:11434)",
	},
	{
		id: "6",
		timestamp: "2026-02-26T00:18:45Z",
		level: "info",
		source: "chat",
		message: "Retrying with fallback model...",
	},
];

const LEVEL_COLORS = {
	info: "text-blue-400",
	warn: "text-amber-400",
	error: "text-red-400",
};

const FILTER_OPTIONS: { value: LogLevel; label: string }[] = [
	{ value: "all", label: "All levels" },
	{ value: "info", label: "Info" },
	{ value: "warn", label: "Warnings" },
	{ value: "error", label: "Errors" },
];

export default function LogsPage() {
	const [filter, setFilter] = useState<LogLevel>("all");
	const logs =
		filter === "all" ? MOCK_LOGS : MOCK_LOGS.filter((l) => l.level === filter);

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold font-heading">Logs</h1>
						<p className="text-xs text-muted-foreground mt-1">
							Real-time system logs from the orchestrator.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5 text-muted-foreground"
								>
									<FunnelIcon className="size-3.5" />
									{FILTER_OPTIONS.find((o) => o.value === filter)?.label}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-32">
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
						<Button
							variant="outline"
							size="icon-sm"
							className="text-muted-foreground"
						>
							<ArrowClockwiseIcon className="size-3.5" />
						</Button>
					</div>
				</div>

				<div className="rounded-xl border border-border overflow-hidden bg-muted/20">
					<div className="overflow-x-auto">
						<table className="w-full text-xs font-mono">
							<thead>
								<tr className="border-b border-border text-muted-foreground">
									<th className="text-left px-4 py-2 font-medium w-44">
										Timestamp
									</th>
									<th className="text-left px-4 py-2 font-medium w-16">
										Level
									</th>
									<th className="text-left px-4 py-2 font-medium w-28">
										Source
									</th>
									<th className="text-left px-4 py-2 font-medium">Message</th>
								</tr>
							</thead>
							<tbody>
								{logs.map((log) => (
									<tr
										key={log.id}
										className="border-b border-border last:border-0 hover:bg-muted/30"
									>
										<td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
											{new Date(log.timestamp).toLocaleTimeString()}
										</td>
										<td
											className={`px-4 py-2 font-medium ${LEVEL_COLORS[log.level]}`}
										>
											{log.level.toUpperCase()}
										</td>
										<td className="px-4 py-2 text-muted-foreground">
											{log.source}
										</td>
										<td className="px-4 py-2">{log.message}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

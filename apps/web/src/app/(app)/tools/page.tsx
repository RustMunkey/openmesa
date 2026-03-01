"use client";

import {
	BrainIcon,
	ClockIcon,
	CodeIcon,
	DatabaseIcon,
	FileIcon,
	FolderIcon,
	GlobeSimpleIcon,
	MagnifyingGlassIcon,
	TerminalIcon,
} from "@phosphor-icons/react";

const TOOLS = [
	{
		name: "bash",
		description: "Execute shell commands",
		icon: TerminalIcon,
		enabled: true,
	},
	{
		name: "read_file",
		description: "Read file contents",
		icon: FileIcon,
		enabled: true,
	},
	{
		name: "write_file",
		description: "Write or create files",
		icon: FileIcon,
		enabled: true,
	},
	{
		name: "list_dir",
		description: "List directory contents",
		icon: FolderIcon,
		enabled: true,
	},
	{
		name: "search_files",
		description: "Search files by content",
		icon: MagnifyingGlassIcon,
		enabled: true,
	},
	{
		name: "fetch_url",
		description: "Fetch data from URLs",
		icon: GlobeSimpleIcon,
		enabled: true,
	},
	{
		name: "remember",
		description: "Save to long-term memory",
		icon: BrainIcon,
		enabled: true,
	},
	{
		name: "schedule",
		description: "Schedule future tasks",
		icon: ClockIcon,
		enabled: false,
	},
	{
		name: "run_code",
		description: "Execute code in sandbox",
		icon: CodeIcon,
		enabled: false,
	},
	{
		name: "query_db",
		description: "Query the database",
		icon: DatabaseIcon,
		enabled: false,
	},
];

export default function ToolsPage() {
	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<div className="mb-4 md:mb-6">
					<h1 className="text-lg font-semibold font-heading">Tools</h1>
					<p className="text-xs text-muted-foreground mt-1">
						Capabilities available to your agents and chat.
					</p>
				</div>

				<div className="space-y-1">
					{TOOLS.map((tool) => (
						<div
							key={tool.name}
							className="flex items-center gap-4 rounded-xl px-4 py-3.5 hover:bg-muted/50"
						>
							<tool.icon className="size-5 shrink-0 text-muted-foreground" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">{tool.name}</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									{tool.description}
								</p>
							</div>
							<span
								className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
									tool.enabled
										? "bg-emerald-500/10 text-emerald-400"
										: "bg-muted text-muted-foreground"
								}`}
							>
								<div
									className={`size-1.5 rounded-full ${tool.enabled ? "bg-emerald-400" : "bg-muted-foreground"}`}
								/>
								{tool.enabled ? "Enabled" : "Coming soon"}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

"use client";

import { PlayIcon, TableIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const TABLES = [
	{
		name: "conversations",
		rows: "—",
		size: "—",
		description: "Chat history and messages",
	},
	{
		name: "memory",
		rows: "—",
		size: "—",
		description: "Long-term memory items",
	},
	{
		name: "embeddings",
		rows: "—",
		size: "—",
		description: "Vector embeddings for semantic search",
	},
	{
		name: "tool_calls",
		rows: "—",
		size: "—",
		description: "Tool execution logs",
	},
	{ name: "agents", rows: "—", size: "—", description: "Agent configurations" },
];

export default function DatabasePage() {
	const [query, setQuery] = useState("");
	const [results, _setResults] = useState<string | null>(null);

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6">
				<div>
					<h1 className="text-xl font-semibold">Database</h1>
					<p className="text-xs text-muted-foreground mt-1">
						Explore and query your Deimos database.
					</p>
				</div>

				{/* Query editor */}
				<div className="rounded-xl border border-border p-4 space-y-3">
					<h2 className="text-sm font-medium">SQL Query</h2>
					<textarea
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="SELECT * FROM conversations LIMIT 10;"
						className="w-full h-24 resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm font-mono outline-none placeholder:text-muted-foreground"
					/>
					<div className="flex items-center justify-between">
						<p className="text-xs text-muted-foreground">
							Connected to local Postgres on port 5433
						</p>
						<Button size="sm" disabled={!query.trim()}>
							<PlayIcon className="size-3.5" />
							Run
						</Button>
					</div>
					{results && (
						<pre className="rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto">
							{results}
						</pre>
					)}
				</div>

				{/* Tables */}
				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border">
						<h2 className="text-sm font-medium">Tables</h2>
					</div>
					<div>
						{TABLES.map((table, i) => (
							<div
								key={table.name}
								className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 ${i < TABLES.length - 1 ? "border-b border-border" : ""}`}
							>
								<TableIcon className="size-4 shrink-0 text-muted-foreground" />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium font-mono">{table.name}</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{table.description}
									</p>
								</div>
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span>{table.rows} rows</span>
									<span>{table.size}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

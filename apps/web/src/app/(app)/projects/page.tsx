"use client";

import {
	ArchiveIcon,
	ArrowCounterClockwiseIcon,
	CheckIcon,
	FloppyDiskIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SortAscendingIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "@/lib/store/projects";

type SortBy = "updated" | "created" | "name";
type Filter = "active" | "archived" | "all";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
	{ value: "updated", label: "Last updated" },
	{ value: "created", label: "Date created" },
	{ value: "name", label: "Name" },
];

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
	{ value: "active", label: "Active" },
	{ value: "archived", label: "Archived" },
	{ value: "all", label: "All" },
];

export default function ProjectsPage() {
	const {
		projects,
		createProject,
		removeProject,
		archiveProject,
		unarchiveProject,
	} = useProjects();
	const [search, setSearch] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [sortBy, setSortBy] = useState<SortBy>("updated");
	const [filter, setFilter] = useState<Filter>("active");

	const filtered = useMemo(() => {
		let result = projects.filter((p) =>
			p.name.toLowerCase().includes(search.toLowerCase()),
		);

		if (filter === "active") result = result.filter((p) => !p.archived);
		else if (filter === "archived") result = result.filter((p) => p.archived);

		result.sort((a, b) => {
			if (sortBy === "name") return a.name.localeCompare(b.name);
			if (sortBy === "created") return b.createdAt - a.createdAt;
			return b.updatedAt - a.updatedAt;
		});

		return result;
	}, [projects, search, sortBy, filter]);

	const handleCreate = () => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		createProject(trimmed);
		setNewName("");
		setIsCreating(false);
	};

	const handleCreateKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleCreate();
		}
		if (e.key === "Escape") {
			setIsCreating(false);
			setNewName("");
		}
	};

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<div className="mb-4 md:mb-6 flex items-center justify-between">
					<h1 className="text-xl font-semibold">Projects</h1>
					<Button size="default" onClick={() => setIsCreating(true)}>
						<PlusIcon className="size-4" data-icon="inline-start" />
						<span className="hidden sm:inline">New Project</span>
						<span className="sm:hidden">New</span>
					</Button>
				</div>

				<div className="mb-4 flex items-center gap-2">
					<div className="relative flex-1 min-w-0">
						<MagnifyingGlassIcon className="absolute start-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search projects..."
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

				{isCreating && (
					<div className="mb-4 flex items-center gap-3 rounded-xl border border-border p-4">
						<FloppyDiskIcon className="size-5 shrink-0 text-muted-foreground" />
						<input
							type="text"
							placeholder="Project name..."
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							onKeyDown={handleCreateKeyDown}
							className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
						<Button size="sm" onClick={handleCreate}>
							Create
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setIsCreating(false);
								setNewName("");
							}}
						>
							Cancel
						</Button>
					</div>
				)}

				{filtered.length === 0 ? (
					<div className="py-16 text-center text-sm text-muted-foreground">
						{projects.length === 0
							? "No projects yet. Create one to get started."
							: filter === "archived"
								? "No archived projects."
								: "No projects match your search."}
					</div>
				) : (
					<div className="space-y-1">
						{filtered.map((project) => (
							<div
								key={project.id}
								className="group flex items-center gap-4 rounded-xl px-4 py-3.5 hover:bg-muted/50"
							>
								<FloppyDiskIcon
									className={`size-5 shrink-0 ${project.archived ? "text-muted-foreground/50" : "text-muted-foreground"}`}
								/>
								<div className="flex-1 min-w-0">
									<p
										className={`truncate text-sm font-medium ${project.archived ? "text-muted-foreground" : ""}`}
									>
										{project.name}
									</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{project.conversationIds.length} chat
										{project.conversationIds.length !== 1 ? "s" : ""} ·{" "}
										{new Date(project.updatedAt).toLocaleDateString()}
										{project.archived && " · Archived"}
									</p>
								</div>
								<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
									{project.archived ? (
										<Button
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-foreground"
											onClick={() => unarchiveProject(project.id)}
											title="Unarchive"
										>
											<ArrowCounterClockwiseIcon className="size-4" />
										</Button>
									) : (
										<Button
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-foreground"
											onClick={() => archiveProject(project.id)}
											title="Archive"
										>
											<ArchiveIcon className="size-4" />
										</Button>
									)}
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-destructive"
										onClick={() => removeProject(project.id)}
										title="Delete"
									>
										<TrashIcon className="size-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

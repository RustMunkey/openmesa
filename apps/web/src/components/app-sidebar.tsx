"use client";

import {
	ArchiveIcon,
	BroadcastIcon,
	BugIcon,
	CaretRightIcon,
	ClockCounterClockwiseIcon,
	DatabaseIcon,
	DotsThreeIcon,
	FloppyDiskIcon,
	FolderIcon,
	FolderPlusIcon,
	HeartIcon,
	MagnifyingGlassIcon,
	MemoryIcon,
	PencilLineIcon,
	PencilSimpleIcon,
	SquaresFourIcon,
	TerminalIcon,
	TimerIcon,
	TrashIcon,
	TreeStructureIcon,
	WebhooksLogoIcon,
	WrenchIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { NavUser } from "@/components/nav-user";
import { SearchDialog } from "@/components/search-dialog";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useConversations } from "@/lib/store/conversations";
import { useGhost } from "@/lib/store/ghost";
import { useProjects } from "@/lib/store/projects";

const userData = {
	name: "Deimos",
	email: "m@example.com",
};

function ChatSubItem({
	id,
	label,
	onDelete,
}: {
	id: string;
	label: string;
	onDelete: () => void;
}) {
	const [confirmOpen, setConfirmOpen] = React.useState(false);
	return (
		<SidebarMenuSubItem className="group/sub-item relative">
			<SidebarMenuSubButton asChild className="pe-8">
				<Link href={`/chat/${id}`}>{label}</Link>
			</SidebarMenuSubButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="absolute top-1/2 end-2 -translate-y-1/2 flex aspect-square w-7 items-center justify-center rounded-md outline-none opacity-0 group-hover/sub-item:opacity-100 data-[state=open]:opacity-100 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
					>
						<DotsThreeIcon className="size-5" weight="bold" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="bottom"
					align="start"
					className="min-w-44"
					portal={false}
				>
					<DropdownMenuItem>
						<HeartIcon />
						Favourite
					</DropdownMenuItem>
					<DropdownMenuItem>
						<FolderPlusIcon />
						Add to project
					</DropdownMenuItem>
					<DropdownMenuItem>
						<PencilLineIcon />
						Rename
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirmOpen(true)}
					>
						<TrashIcon />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
						<AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SidebarMenuSubItem>
	);
}

function ProjectSubItem({
	id: _id,
	label,
	onDelete,
	onArchive,
}: {
	id: string;
	label: string;
	onDelete: () => void;
	onArchive: () => void;
}) {
	const [confirmOpen, setConfirmOpen] = React.useState(false);
	return (
		<SidebarMenuSubItem className="group/sub-item relative">
			<SidebarMenuSubButton asChild className="pe-8">
				<Link href="/projects">{label}</Link>
			</SidebarMenuSubButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="absolute top-1/2 end-2 -translate-y-1/2 flex aspect-square w-7 items-center justify-center rounded-md outline-none opacity-0 group-hover/sub-item:opacity-100 data-[state=open]:opacity-100 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
					>
						<DotsThreeIcon className="size-5" weight="bold" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="bottom"
					align="start"
					className="min-w-44"
					portal={false}
				>
					<DropdownMenuItem>
						<PencilLineIcon />
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onArchive}>
						<ArchiveIcon />
						Archive
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirmOpen(true)}
					>
						<TrashIcon />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete project?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this project and all its contents.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SidebarMenuSubItem>
	);
}

function EmptySubItem({ label }: { label: string }) {
	return (
		<SidebarMenuSubItem>
			<SidebarMenuSubButton className="text-muted-foreground text-xs">
				{label}
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const [searchOpen, setSearchOpen] = React.useState(false);
	const router = useRouter();
	const { conversations, removeConversation, setActive } = useConversations();
	const { projects, removeProject, archiveProject } = useProjects();
	const ghostActive = useGhost((s) => s.active);

	const recentChats = conversations.slice(0, 5);

	const handleNewChat = () => {
		setActive(null);
		router.push("/chat");
	};

	return (
		<>
			<SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
			<Sidebar variant="inset" collapsible="icon" {...props}>
				<div
					className={`transition-opacity duration-500 ease-out flex flex-col flex-1 min-h-0 ${ghostActive ? "opacity-0 pointer-events-none" : "opacity-100"}`}
				>
					<SidebarHeader className="sticky top-0 z-10 bg-sidebar px-2 py-2 group-data-[collapsible=icon]:px-0 transition-[padding] duration-75 ease-out">
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={handleNewChat}
								className="group-data-[collapsible=icon]:hidden cursor-pointer"
							>
								<span
									className="font-versa text-foreground leading-none"
									style={{ fontSize: "18px" }}
								>
									DEIMOS
								</span>
							</button>
							<SidebarTrigger />
						</div>
					</SidebarHeader>

					<SidebarContent>
						{/* Quick Actions */}
						<SidebarGroup className="px-0">
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Search"
										onClick={() => setSearchOpen(true)}
									>
										<MagnifyingGlassIcon />
										<span>Search</span>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton tooltip="New chat" onClick={handleNewChat}>
										<PencilSimpleIcon />
										<span>New chat</span>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Overview">
										<Link href="/overview">
											<SquaresFourIcon />
											<span>Overview</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>

						{/* Workspace */}
						<SidebarGroup className="px-0">
							<SidebarGroupLabel>Workspace</SidebarGroupLabel>
							<SidebarMenu>
								<Collapsible asChild defaultOpen={false}>
									<SidebarMenuItem>
										<SidebarMenuButton asChild tooltip="Agents">
											<Link href="/agents">
												<FloppyDiskIcon />
												<span>Agents</span>
											</Link>
										</SidebarMenuButton>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction className="data-[state=open]:rotate-90">
												<CaretRightIcon />
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
											<SidebarMenuSub>
												<EmptySubItem label="No agents yet" />
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>

								<Collapsible asChild defaultOpen={false}>
									<SidebarMenuItem>
										<SidebarMenuButton asChild tooltip="Projects">
											<Link href="/projects">
												<FolderIcon />
												<span>Projects</span>
											</Link>
										</SidebarMenuButton>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction className="data-[state=open]:rotate-90">
												<CaretRightIcon />
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
											<SidebarMenuSub>
												{projects.length === 0 ? (
													<EmptySubItem label="No projects yet" />
												) : (
													projects
														.filter((p) => !p.archived)
														.slice(0, 5)
														.map((p) => (
															<ProjectSubItem
																key={p.id}
																id={p.id}
																label={p.name}
																onDelete={() => removeProject(p.id)}
																onArchive={() => archiveProject(p.id)}
															/>
														))
												)}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>

								<Collapsible asChild defaultOpen={false}>
									<SidebarMenuItem>
										<SidebarMenuButton asChild tooltip="Workflows">
											<Link href="/workflows">
												<TreeStructureIcon />
												<span>Workflows</span>
											</Link>
										</SidebarMenuButton>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction className="data-[state=open]:rotate-90">
												<CaretRightIcon />
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
											<SidebarMenuSub>
												<EmptySubItem label="No workflows yet" />
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>

								<Collapsible asChild defaultOpen={false}>
									<SidebarMenuItem>
										<SidebarMenuButton asChild tooltip="History">
											<Link href="/history">
												<ClockCounterClockwiseIcon />
												<span>History</span>
											</Link>
										</SidebarMenuButton>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction className="data-[state=open]:rotate-90">
												<CaretRightIcon />
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
											<SidebarMenuSub>
												{recentChats.length === 0 ? (
													<EmptySubItem label="No chats yet" />
												) : (
													recentChats.map((c) => (
														<ChatSubItem
															key={c.id}
															id={c.id}
															label={c.title}
															onDelete={() => removeConversation(c.id)}
														/>
													))
												)}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							</SidebarMenu>
						</SidebarGroup>

						{/* Build */}
						<SidebarGroup className="px-0">
							<SidebarGroupLabel>Build</SidebarGroupLabel>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Tools">
										<Link href="/tools">
											<WrenchIcon />
											<span>Tools</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Memory">
										<Link href="/memory">
											<MemoryIcon />
											<span>Memory</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Database">
										<Link href="/database">
											<DatabaseIcon />
											<span>Database</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Cron Jobs">
										<Link href="/cron-jobs">
											<TimerIcon />
											<span>Cron Jobs</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>

						{/* Connect */}
						<SidebarGroup className="px-0">
							<SidebarGroupLabel>Connect</SidebarGroupLabel>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Channels">
										<Link href="/channels">
											<BroadcastIcon />
											<span>Channels</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Webhooks">
										<Link href="/webhooks">
											<WebhooksLogoIcon />
											<span>Webhooks</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>

						{/* Observe */}
						<SidebarGroup className="px-0">
							<SidebarGroupLabel>Observe</SidebarGroupLabel>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Logs">
										<Link href="/logs">
											<TerminalIcon />
											<span>Logs</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Debug">
										<Link href="/debug">
											<BugIcon />
											<span>Debug</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>
					</SidebarContent>

					<SidebarFooter className="px-0 pb-0">
						<NavUser user={userData} />
					</SidebarFooter>
				</div>
			</Sidebar>
		</>
	);
}

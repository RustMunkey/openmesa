"use client";

import {
	BroadcastIcon,
	BugIcon,
	ChatCircleIcon,
	ClockCounterClockwiseIcon,
	CreditCardIcon,
	DatabaseIcon,
	FolderIcon,
	GearIcon,
	NoteIcon,
	PencilSimpleIcon,
	QuestionIcon,
	ShieldCheckIcon,
	SquaresFourIcon,
	TerminalIcon,
	WebhooksLogoIcon,
	WrenchIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useConversations } from "@/lib/store/conversations";
import { useProjects } from "@/lib/store/projects";

const PAGES = [
	{ label: "Overview", href: "/overview", icon: SquaresFourIcon },
	{ label: "New Chat", href: "/chat", icon: PencilSimpleIcon },
	{ label: "History", href: "/history", icon: ClockCounterClockwiseIcon },
	{ label: "Tools", href: "/tools", icon: WrenchIcon },
	{ label: "Memory", href: "/memory", icon: NoteIcon },
	{ label: "Database", href: "/database", icon: DatabaseIcon },
	{ label: "Channels", href: "/channels", icon: BroadcastIcon },
	{ label: "Webhooks", href: "/webhooks", icon: WebhooksLogoIcon },
	{ label: "Logs", href: "/logs", icon: TerminalIcon },
	{ label: "Debug", href: "/debug", icon: BugIcon },
	{ label: "Settings", href: "/settings", icon: GearIcon },
	{ label: "Security", href: "/settings/security", icon: ShieldCheckIcon },
	{ label: "Billing & Usage", href: "/settings/billing", icon: CreditCardIcon },
	{ label: "Help & Support", href: "/settings/help", icon: QuestionIcon },
];

export function SearchDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const { conversations, setActive } = useConversations();
	const { projects } = useProjects();

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChange(!open);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [open, onOpenChange]);

	const go = (path: string) => {
		onOpenChange(false);
		router.push(path);
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Search"
			description="Search across chats, projects, and pages"
		>
			<Command>
				<CommandInput placeholder="Search everything..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>

					<CommandGroup heading="Pages">
						{PAGES.map((page) => (
							<CommandItem key={page.href} onSelect={() => go(page.href)}>
								<page.icon className="size-4" />
								<span>{page.label}</span>
							</CommandItem>
						))}
					</CommandGroup>

					{conversations.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Conversations">
								{conversations.slice(0, 10).map((c) => (
									<CommandItem
										key={c.id}
										onSelect={() => {
											setActive(c.id);
											go(`/chat/${c.id}`);
										}}
									>
										<ChatCircleIcon className="size-4" />
										<span>{c.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						</>
					)}

					{projects.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Projects">
								{projects
									.filter((p) => !p.archived)
									.map((p) => (
										<CommandItem key={p.id} onSelect={() => go("/projects")}>
											<FolderIcon className="size-4" />
											<span>{p.name}</span>
										</CommandItem>
									))}
							</CommandGroup>
						</>
					)}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}

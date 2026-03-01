"use client";

import {
	BookOpenIcon,
	CaretUpDownIcon,
	CreditCardIcon,
	DownloadSimpleIcon,
	GearIcon,
	QuestionIcon,
	ShieldCheckIcon,
	SignOutIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavUser({
	user,
}: {
	user: {
		name: string;
		email: string;
	};
}) {
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	const avatarEl = (
		<div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold bg-sidebar-accent text-sidebar-foreground select-none">
			{user.name.slice(0, 2).toUpperCase()}
		</div>
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem className="group/footer relative">
				<DropdownMenu>
					<div className="flex w-full items-center gap-2 px-2 py-2 transition-[padding] duration-150 ease-out group-data-[collapsible=icon]:px-0!">
						{isCollapsed ? (
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="h-10 w-10 shrink-0 rounded-full outline-none cursor-pointer transition-[margin] duration-150 ease-out group-data-[collapsible=icon]:mx-auto"
								>
									{avatarEl}
								</button>
							</DropdownMenuTrigger>
						) : (
							<div className="transition-[margin] duration-150 ease-out">
								{avatarEl}
							</div>
						)}
						<div className="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden overflow-hidden">
							<span className="truncate font-medium">{user.name}</span>
							<span className="truncate text-xs text-sidebar-foreground/50">
								{user.email}
							</span>
						</div>
					</div>
					{!isCollapsed && (
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="absolute top-1/2 end-2 -translate-y-1/2 flex aspect-square w-7 items-center justify-center rounded-md outline-none hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
							>
								<CaretUpDownIcon className="size-5" />
							</button>
						</DropdownMenuTrigger>
					)}
					<DropdownMenuContent
						className="min-w-56 rounded-xl"
						side={isCollapsed ? "right" : "top"}
						align="end"
						sideOffset={isCollapsed ? 4 : 4}
					>
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/settings">
									<GearIcon />
									Settings
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/settings/security">
									<ShieldCheckIcon />
									Security
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/settings/billing">
									<CreditCardIcon />
									Billing & Usage
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/settings/help">
									<QuestionIcon />
									Help & Support
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/docs">
									<BookOpenIcon />
									Documentation
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<DownloadSimpleIcon />
								Download CLI
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem>
							<SignOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

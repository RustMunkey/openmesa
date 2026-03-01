"use client";

import { GhostIcon, XIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ConnectionsDock } from "@/components/connections-dock";
import { MobileHeader } from "@/components/mobile-header";
import {
	SidebarInset,
	SidebarProvider,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGhost } from "@/lib/store/ghost";

function GhostToggle() {
	const ghostMode = useGhost((s) => s.active);
	const setGhostActive = useGhost((s) => s.setActive);
	const sidebar = useSidebar();
	const sidebarWasOpen = useRef(sidebar.open);

	const toggleGhost = useCallback(() => {
		if (!ghostMode) {
			sidebarWasOpen.current = sidebar.open;
			if (sidebar.open) sidebar.setOpen(false);
			setGhostActive(true);
		} else {
			if (sidebarWasOpen.current) sidebar.setOpen(true);
			setGhostActive(false);
		}
	}, [ghostMode, sidebar, setGhostActive]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={toggleGhost}
					className={`flex size-9 items-center justify-center cursor-pointer outline-none transition-colors ${
						ghostMode
							? "text-foreground hover:text-foreground/70"
							: "text-sidebar-foreground/70 hover:text-sidebar-foreground"
					}`}
				>
					{ghostMode ? (
						<XIcon className="size-[22px]" weight="bold" />
					) : (
						<GhostIcon className="size-[22px]" />
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="left">
				{ghostMode ? "Exit ghost mode" : "Ghost mode"}
			</TooltipContent>
		</Tooltip>
	);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const ghostActive = useGhost((s) => s.active);
	const pathname = usePathname();
	const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");

	return (
		<SidebarProvider
			className={ghostActive ? "has-data-[variant=inset]:!bg-background" : ""}
		>
			<AppSidebar />
			<SidebarInset>
				<div
					className={`transition-all duration-300 ease-out overflow-hidden ${ghostActive ? "max-h-0 opacity-0" : "max-h-16 opacity-100"}`}
				>
					<MobileHeader trailing={isChatPage ? <GhostToggle /> : undefined} />
				</div>
				{children}
			</SidebarInset>
			<ConnectionsDock />
		</SidebarProvider>
	);
}

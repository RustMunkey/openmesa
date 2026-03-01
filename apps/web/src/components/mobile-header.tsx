"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function MobileHeader({ trailing }: { trailing?: React.ReactNode }) {
	return (
		<div className="flex md:hidden items-center justify-between h-12 px-3 shrink-0">
			<SidebarTrigger />
			{trailing}
		</div>
	);
}

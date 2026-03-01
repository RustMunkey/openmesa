"use client";

import { ChatCircleDotsIcon, DeviceMobileIcon } from "@phosphor-icons/react";

const CHANNELS = [
	{
		id: "imessage",
		name: "iMessage",
		description: "Send and receive prompts via iMessage.",
		icon: ChatCircleDotsIcon,
		status: "coming-soon" as const,
	},
	{
		id: "telegram",
		name: "Telegram",
		description: "Connect a Telegram bot to Deimos.",
		icon: DeviceMobileIcon,
		status: "coming-soon" as const,
	},
];

export function ConnectionsPanel() {
	return (
		<div className="space-y-2">
			{CHANNELS.map((ch) => (
				<div
					key={ch.id}
					className="flex items-center gap-4 rounded-xl border border-border p-4"
				>
					<ch.icon className="size-5 shrink-0 text-muted-foreground" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium">{ch.name}</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							{ch.description}
						</p>
					</div>
					<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
						Coming soon
					</span>
				</div>
			))}
		</div>
	);
}

"use client";

import {
	DiscordLogoIcon,
	EnvelopeIcon,
	SlackLogoIcon,
	TelegramLogoIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Channel = {
	id: string;
	name: string;
	type: "slack" | "discord" | "telegram" | "email";
	status: "connected" | "disconnected";
	lastMessage: string | null;
};

const CHANNEL_ICONS = {
	slack: SlackLogoIcon,
	discord: DiscordLogoIcon,
	telegram: TelegramLogoIcon,
	email: EnvelopeIcon,
};

const AVAILABLE_CHANNELS = [
	{
		type: "slack" as const,
		name: "Slack",
		description: "Connect Deimos to your Slack workspace",
	},
	{
		type: "discord" as const,
		name: "Discord",
		description: "Add Deimos as a Discord bot",
	},
	{
		type: "telegram" as const,
		name: "Telegram",
		description: "Deploy Deimos as a Telegram bot",
	},
	{
		type: "email" as const,
		name: "Email",
		description: "Process incoming emails with Deimos",
	},
];

export default function ChannelsPage() {
	const [channels] = useState<Channel[]>([]);

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6">
				<div>
					<h1 className="text-lg font-semibold font-heading">Channels</h1>
					<p className="text-xs text-muted-foreground mt-1">
						Connect Deimos to external messaging platforms.
					</p>
				</div>

				{channels.length > 0 && (
					<div className="rounded-xl border border-border overflow-hidden">
						<div className="px-4 py-3 border-b border-border">
							<h2 className="text-sm font-medium">Connected</h2>
						</div>
						{channels.map((ch) => {
							const Icon = CHANNEL_ICONS[ch.type];
							return (
								<div
									key={ch.id}
									className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/50"
								>
									<Icon className="size-5 shrink-0 text-muted-foreground" />
									<div className="flex-1">
										<p className="text-sm font-medium">{ch.name}</p>
										<p className="text-xs text-muted-foreground">{ch.status}</p>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border">
						<h2 className="text-sm font-medium">Available Integrations</h2>
					</div>
					{AVAILABLE_CHANNELS.map((ch, i) => {
						const Icon = CHANNEL_ICONS[ch.type];
						return (
							<div
								key={ch.type}
								className={`flex items-center gap-4 px-4 py-3.5 ${i < AVAILABLE_CHANNELS.length - 1 ? "border-b border-border" : ""}`}
							>
								<Icon className="size-5 shrink-0 text-muted-foreground" />
								<div className="flex-1">
									<p className="text-sm font-medium">{ch.name}</p>
									<p className="text-xs text-muted-foreground">
										{ch.description}
									</p>
								</div>
								<Button variant="outline" size="sm">
									Connect
								</Button>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

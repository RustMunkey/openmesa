"use client";

import {
	BookOpenIcon,
	ChatCircleDotsIcon,
	GithubLogoIcon,
} from "@phosphor-icons/react";

const LINKS = [
	{
		icon: BookOpenIcon,
		label: "Documentation",
		description: "Guides, API reference, and tutorials.",
		href: "/docs",
	},
	{
		icon: GithubLogoIcon,
		label: "GitHub",
		description: "Report bugs, request features, or contribute.",
		href: "#",
	},
	{
		icon: ChatCircleDotsIcon,
		label: "Community",
		description: "Join the discussion on Discord.",
		href: "#",
	},
];

export default function HelpPage() {
	return (
		<div>
			<div className="mb-6">
				<h2 className="text-base font-semibold">Help & Support</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Resources and ways to get help.
				</p>
			</div>

			<div className="space-y-2">
				{LINKS.map((link) => (
					<a
						key={link.label}
						href={link.href}
						className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors"
					>
						<link.icon className="size-5 shrink-0 text-muted-foreground" />
						<div>
							<p className="text-sm font-medium">{link.label}</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{link.description}
							</p>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}

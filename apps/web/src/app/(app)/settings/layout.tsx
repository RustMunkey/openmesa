"use client";

import {
	CreditCardIcon,
	GearIcon,
	PlugIcon,
	QuestionIcon,
	ShareNetworkIcon,
	ShieldCheckIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
	{ href: "/settings", label: "General", icon: GearIcon },
	{ href: "/settings/integrations", label: "Integrations", icon: PlugIcon },
	{
		href: "/settings/connections",
		label: "Connections",
		icon: ShareNetworkIcon,
	},
	{ href: "/settings/security", label: "Security", icon: ShieldCheckIcon },
	{ href: "/settings/billing", label: "Billing & Usage", icon: CreditCardIcon },
	{ href: "/settings/help", label: "Help & Support", icon: QuestionIcon },
];

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<h1 className="text-xl font-semibold mb-4 md:mb-6">Settings</h1>
				{/* Mobile: horizontal scrollable tabs */}
				<nav className="md:hidden -mx-4 px-4 mb-4 overflow-x-auto no-scrollbar">
					<div className="flex gap-1 min-w-max">
						{NAV_ITEMS.map((item) => {
							const isActive = pathname === item.href;
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
										isActive
											? "bg-muted text-foreground font-medium"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									<item.icon className="size-4 shrink-0" />
									{item.label}
								</Link>
							);
						})}
					</div>
				</nav>
				<div className="flex gap-8">
					{/* Desktop: vertical sidebar nav */}
					<nav className="hidden md:flex w-48 shrink-0">
						<ul className="space-y-0.5 sticky top-0 self-start w-full">
							{NAV_ITEMS.map((item) => {
								const isActive = pathname === item.href;
								return (
									<li key={item.href}>
										<Link
											href={item.href}
											className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
												isActive
													? "bg-muted text-foreground font-medium"
													: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
											}`}
										>
											<item.icon className="size-4 shrink-0" />
											{item.label}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>
					<div className="flex-1 min-w-0">{children}</div>
				</div>
			</div>
		</div>
	);
}

"use client";

import {
	CopyIcon,
	PlusIcon,
	TrashIcon,
	WebhooksLogoIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Webhook = {
	id: string;
	name: string;
	url: string;
	events: string[];
	status: "active" | "disabled";
	lastTriggered: string | null;
};

export default function WebhooksPage() {
	const [webhooks] = useState<Webhook[]>([]);

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold font-heading">Webhooks</h1>
						<p className="text-xs text-muted-foreground mt-1">
							Trigger external services when events happen in Deimos.
						</p>
					</div>
					<Button size="default">
						<PlusIcon className="size-4" />
						New Webhook
					</Button>
				</div>

				{webhooks.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<WebhooksLogoIcon className="size-10 text-muted-foreground/30 mb-4" />
						<p className="text-sm text-muted-foreground mb-1">
							No webhooks configured
						</p>
						<p className="text-xs text-muted-foreground">
							Create a webhook to send real-time notifications to your services.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{webhooks.map((wh) => (
							<div key={wh.id} className="rounded-xl border border-border p-4">
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">{wh.name}</p>
										<span
											className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
												wh.status === "active"
													? "bg-emerald-500/10 text-emerald-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{wh.status}
										</span>
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground hover:text-destructive"
									>
										<TrashIcon className="size-4" />
									</Button>
								</div>
								<div className="flex items-center gap-2">
									<code className="flex-1 truncate text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
										{wh.url}
									</code>
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground shrink-0"
										onClick={() => {
											navigator.clipboard.writeText(wh.url);
											toast.success("Copied");
										}}
									>
										<CopyIcon className="size-3.5" />
									</Button>
								</div>
								<div className="flex items-center gap-2 mt-2">
									{wh.events.map((ev) => (
										<span
											key={ev}
											className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
										>
											{ev}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

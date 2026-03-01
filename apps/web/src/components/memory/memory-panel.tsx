"use client";

import { PushPinIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useMemory } from "@/lib/store/memory";

export function MemoryPanel() {
	const { pins, notes, unpin, updateNotes } = useMemory();

	return (
		<div className="w-full">
			<div className="mb-6">
				<h2 className="text-base font-semibold">Pinned Items</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Important context the agent should always remember.
				</p>
			</div>

			{pins.length === 0 ? (
				<p className="text-sm text-muted-foreground mb-8">
					No pinned items yet.
				</p>
			) : (
				<div className="space-y-2 mb-8">
					{pins.map((item) => (
						<div
							key={item.id}
							className="group flex items-start gap-3 rounded-xl border border-border p-3"
						>
							<PushPinIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
							<p className="flex-1 text-sm">{item.content}</p>
							<Button
								variant="ghost"
								size="icon-xs"
								className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
								onClick={() => unpin(item.id)}
							>
								<TrashIcon className="size-3.5" />
							</Button>
						</div>
					))}
				</div>
			)}

			<div className="mb-4">
				<h2 className="text-base font-semibold">Notes</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Saved notes and context from conversations.
				</p>
			</div>

			<textarea
				value={notes}
				onChange={(e) => updateNotes(e.target.value)}
				placeholder="Write notes here..."
				className="w-full min-h-40 rounded-xl border border-border bg-background p-4 text-sm outline-none placeholder:text-muted-foreground resize-y focus:ring-1 focus:ring-ring"
			/>
		</div>
	);
}

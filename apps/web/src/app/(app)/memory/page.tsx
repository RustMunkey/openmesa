"use client";

import { MemoryPanel } from "@/components/memory/memory-panel";

export default function MemoryPage() {
	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl">
				<h1 className="text-xl font-semibold mb-4 md:mb-6">Memory</h1>
				<MemoryPanel />
			</div>
		</div>
	);
}

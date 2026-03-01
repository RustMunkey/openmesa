import { ConnectionsPanel } from "@/components/connections/connections-panel";

export default function ConnectionsPage() {
	return (
		<div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
			<div>
				<h1 className="text-xl font-semibold">Connections</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Connect Deimos to messaging platforms. Prompt from your phone, control
					your Mac remotely.
				</p>
			</div>
			<ConnectionsPanel />
		</div>
	);
}

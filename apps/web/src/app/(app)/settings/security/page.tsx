export default function SecurityPage() {
	return (
		<div>
			<div className="mb-6">
				<h2 className="text-base font-semibold">Security</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Manage sessions and security preferences.
				</p>
			</div>

			<div className="space-y-6">
				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Active Sessions</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Devices and browsers currently signed in.
					</p>
					<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
						<div className="size-2 rounded-full bg-green-500" />
						<div className="flex-1">
							<p className="text-sm font-medium">This device</p>
							<p className="text-xs text-muted-foreground">Current session</p>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">API Key Vault</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Your API keys are encrypted and stored locally. No keys are
						transmitted externally.
					</p>
					<p className="text-sm text-muted-foreground">
						Manage your keys in the{" "}
						<a
							href="/settings/integrations"
							className="text-primary hover:underline"
						>
							Integrations
						</a>{" "}
						tab.
					</p>
				</div>
			</div>
		</div>
	);
}

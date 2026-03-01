export default function BillingPage() {
	return (
		<div>
			<div className="mb-6">
				<h2 className="text-base font-semibold">Billing & Usage</h2>
				<p className="text-xs text-muted-foreground mt-1">
					Track your API usage across providers. Costs are billed directly by
					each provider.
				</p>
			</div>

			<div className="space-y-6">
				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Usage Overview</h3>
					<p className="text-xs text-muted-foreground mb-4">
						Token usage across all configured providers.
					</p>
					<div className="grid grid-cols-3 gap-4">
						<div className="rounded-lg bg-muted/50 p-3">
							<p className="text-xs text-muted-foreground">Total Requests</p>
							<p className="text-lg font-semibold mt-1">0</p>
						</div>
						<div className="rounded-lg bg-muted/50 p-3">
							<p className="text-xs text-muted-foreground">Tokens Used</p>
							<p className="text-lg font-semibold mt-1">0</p>
						</div>
						<div className="rounded-lg bg-muted/50 p-3">
							<p className="text-xs text-muted-foreground">Est. Cost</p>
							<p className="text-lg font-semibold mt-1">$0.00</p>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border p-4">
					<h3 className="text-sm font-medium mb-1">Billing</h3>
					<p className="text-xs text-muted-foreground">
						Deimos is BYOK (Bring Your Own Key). You are billed directly by the
						AI providers whose API keys you use (Anthropic, OpenAI, etc). Check
						your provider dashboards for billing details.
					</p>
				</div>
			</div>
		</div>
	);
}

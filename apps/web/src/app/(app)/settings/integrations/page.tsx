"use client";

import { ModelManager } from "@/components/settings/model-manager";
import { ProviderForm } from "@/components/settings/provider-form";

export default function IntegrationsPage() {
	return (
		<div className="space-y-10">
			<div>
				<div className="mb-6">
					<h2 className="text-base font-semibold">Providers</h2>
					<p className="text-xs text-muted-foreground mt-1">
						Configure your API keys. Deimos is BYOK — bring your own key. All
						keys are stored locally in your browser.
					</p>
				</div>
				<ProviderForm />
			</div>
			<div>
				<div className="mb-6">
					<h2 className="text-base font-semibold">Models</h2>
					<p className="text-xs text-muted-foreground mt-1">
						Manage models available in the chat selector. Add any model your
						provider supports.
					</p>
				</div>
				<ModelManager />
			</div>
		</div>
	);
}

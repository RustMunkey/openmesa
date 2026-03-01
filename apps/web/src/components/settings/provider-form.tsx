"use client";

import {
	ArrowsClockwiseIcon,
	CheckIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProviderId } from "@/lib/agent/types";
import { PROVIDERS } from "@/lib/providers";
import { useSettings } from "@/lib/store/settings";

function ProviderCard({ id }: { id: ProviderId }) {
	// biome-ignore lint/style/noNonNullAssertion: id comes from ProviderId, always exists in PROVIDERS
	const provider = PROVIDERS.find((p) => p.id === id)!;
	const { providers, activeProvider, setProviderConfig, setActiveProvider } =
		useSettings();
	const config = providers[id] ?? {
		key: "",
		model: provider.models[0] ?? "",
		url: "",
	};
	const [showKey, setShowKey] = useState(false);
	const [fetchedModels, setFetchedModels] = useState<string[] | null>(null);
	const [fetching, setFetching] = useState(false);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const isActive = activeProvider === id;

	const models = fetchedModels ?? provider.models;

	const doFetch = useCallback(async () => {
		if (!provider.fetchModels) return;
		const key = config.key;
		const url = config.url;
		if (provider.requiresKey && !key) return;
		setFetching(true);
		setFetchError(null);
		try {
			const result = await provider.fetchModels(key, url || undefined);
			setFetchedModels(result);
			// If current model isn't in fetched list, reset to first
			if (result.length > 0 && !result.includes(config.model)) {
				setProviderConfig(id, { model: result[0] });
			}
		} catch (e) {
			setFetchError(e instanceof Error ? e.message : "Failed");
		} finally {
			setFetching(false);
		}
	}, [provider, config.key, config.url, config.model, id, setProviderConfig]);

	// Auto-fetch on mount if key is present
	useEffect(() => {
		if (provider.fetchModels && (!provider.requiresKey || config.key)) {
			doFetch();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [config.key, doFetch, provider.fetchModels, provider.requiresKey]);

	return (
		<div
			className={`rounded-xl border p-4 ${isActive ? "border-primary/50 bg-primary/5" : "border-border"}`}
		>
			<div className="flex items-center justify-between mb-3">
				<div>
					<h3 className="text-sm font-medium">{provider.name}</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						{fetchedModels
							? `${fetchedModels.length} models`
							: `${provider.models.length} models`}
						{fetchedModels && <span className="text-primary"> · live</span>}
					</p>
				</div>
				{isActive ? (
					<span className="flex items-center gap-1 text-xs text-primary font-medium">
						<CheckIcon className="size-3.5" />
						Active
					</span>
				) : (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setActiveProvider(id)}
					>
						Set active
					</Button>
				)}
			</div>

			{provider.requiresKey && (
				<div className="mb-3">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
					<label className="text-xs text-muted-foreground mb-1 block">
						API Key
					</label>
					<div className="relative">
						<input
							type={showKey ? "text" : "password"}
							value={config.key}
							onChange={(e) => setProviderConfig(id, { key: e.target.value })}
							placeholder={`Enter ${provider.name} API key...`}
							className="h-9 w-full rounded-lg border border-border bg-background px-3 pe-9 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/20"
						/>
						<button
							type="button"
							onClick={() => setShowKey(!showKey)}
							className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
						>
							{showKey ? (
								<EyeSlashIcon className="size-4" />
							) : (
								<EyeIcon className="size-4" />
							)}
						</button>
					</div>
				</div>
			)}

			{provider.baseUrl && (
				<div className="mb-3">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
					<label className="text-xs text-muted-foreground mb-1 block">
						Base URL
					</label>
					<input
						type="text"
						value={config.url}
						onChange={(e) => setProviderConfig(id, { url: e.target.value })}
						placeholder={provider.baseUrl}
						className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/20"
					/>
				</div>
			)}

			<div>
				<div className="flex items-center justify-between mb-1">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label only */}
					<label className="text-xs text-muted-foreground">Default Model</label>
					{provider.fetchModels && (
						<button
							type="button"
							onClick={doFetch}
							disabled={fetching || (provider.requiresKey && !config.key)}
							className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
						>
							<ArrowsClockwiseIcon
								className={`size-3 ${fetching ? "animate-spin" : ""}`}
							/>
							{fetching
								? "Fetching..."
								: fetchError
									? `Error: ${fetchError}`
									: "Refresh models"}
						</button>
					)}
				</div>
				<Select
					value={config.model}
					onValueChange={(val) => setProviderConfig(id, { model: val })}
				>
					<SelectTrigger className="w-full rounded-lg">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{models.map((m) => (
							<SelectItem key={m} value={m}>
								{m}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

export function ProviderForm() {
	return (
		<div className="space-y-3">
			{PROVIDERS.map((p) => (
				<ProviderCard key={p.id} id={p.id} />
			))}
		</div>
	);
}

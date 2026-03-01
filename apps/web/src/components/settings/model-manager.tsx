"use client";

import {
	CheckIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProviderId } from "@/lib/agent/types";
import { type ModelEntry, useModels } from "@/lib/store/models";

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
	{ id: "anthropic", label: "Anthropic" },
	{ id: "openai", label: "OpenAI" },
	{ id: "google", label: "Google" },
	{ id: "mistral", label: "Mistral" },
	{ id: "groq", label: "Groq" },
	{ id: "xai", label: "xAI" },
	{ id: "cohere", label: "Cohere" },
	{ id: "perplexity", label: "Perplexity" },
	{ id: "deepseek", label: "DeepSeek" },
	{ id: "together", label: "Together AI" },
	{ id: "openrouter", label: "OpenRouter" },
	{ id: "fireworks", label: "Fireworks AI" },
	{ id: "cerebras", label: "Cerebras" },
	{ id: "azure", label: "Azure OpenAI" },
	{ id: "huggingface", label: "Hugging Face" },
	{ id: "ai21", label: "AI21 Labs" },
	{ id: "ollama", label: "Ollama" },
];

function AddModelRow({ onAdd }: { onAdd: (entry: ModelEntry) => void }) {
	const [open, setOpen] = useState(false);
	const [id, setId] = useState("");
	const [label, setLabel] = useState("");
	const [provider, setProvider] = useState<ProviderId>("ollama");

	const handleAdd = () => {
		const trimId = id.trim();
		const trimLabel = label.trim();
		if (!trimId) return;
		onAdd({ id: trimId, label: trimLabel || trimId, provider });
		setId("");
		setLabel("");
		setProvider("ollama");
		setOpen(false);
	};

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
			>
				<PlusIcon className="size-4" />
				Add model
			</button>
		);
	}

	return (
		<div className="flex items-end gap-2 rounded-xl border border-border p-3">
			<div className="flex-1 min-w-0">
				{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
				<label className="text-xs text-muted-foreground mb-1 block">
					Model ID
				</label>
				<input
					type="text"
					value={id}
					onChange={(e) => setId(e.target.value)}
					placeholder="e.g. qwen2.5:7b"
					className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
					onKeyDown={(e) => e.key === "Enter" && handleAdd()}
				/>
			</div>
			<div className="flex-1 min-w-0">
				{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
				<label className="text-xs text-muted-foreground mb-1 block">
					Display Name
				</label>
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="e.g. Qwen 2.5 7B"
					className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
					onKeyDown={(e) => e.key === "Enter" && handleAdd()}
				/>
			</div>
			<div className="w-36 shrink-0">
				{/* biome-ignore lint/a11y/noLabelWithoutControl: visual label, input is adjacent */}
				<label className="text-xs text-muted-foreground mb-1 block">
					Provider
				</label>
				<Select
					value={provider}
					onValueChange={(val) => setProvider(val as ProviderId)}
				>
					<SelectTrigger size="sm" className="w-full rounded-lg">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PROVIDER_OPTIONS.map((p) => (
							<SelectItem key={p.id} value={p.id}>
								{p.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-1 shrink-0">
				<Button size="icon-sm" onClick={handleAdd} disabled={!id.trim()}>
					<CheckIcon className="size-3.5" />
				</Button>
				<Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}>
					<XIcon className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}

function ModelRow({ entry }: { entry: ModelEntry }) {
	const { remove, update } = useModels();
	const [editing, setEditing] = useState(false);
	const [label, setLabel] = useState(entry.label);

	const handleSave = () => {
		const trimmed = label.trim();
		if (trimmed && trimmed !== entry.label) {
			update(entry.id, { label: trimmed });
		}
		setEditing(false);
	};

	const providerLabel =
		PROVIDER_OPTIONS.find((p) => p.id === entry.provider)?.label ??
		entry.provider;

	return (
		<div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
			<div className="flex-1 min-w-0">
				{editing ? (
					<input
						type="text"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						onBlur={handleSave}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSave();
							if (e.key === "Escape") {
								setLabel(entry.label);
								setEditing(false);
							}
						}}
						className="h-7 w-full rounded border border-border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
					/>
				) : (
					<span className="text-sm">{entry.label}</span>
				)}
			</div>
			<span className="text-xs text-muted-foreground shrink-0">
				{providerLabel}
			</span>
			<code className="text-xs text-muted-foreground font-mono shrink-0">
				{entry.id}
			</code>
			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
				<button
					type="button"
					onClick={() => {
						setLabel(entry.label);
						setEditing(true);
					}}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
				>
					<PencilSimpleIcon className="size-3.5" />
				</button>
				<button
					type="button"
					onClick={() => remove(entry.id)}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
				>
					<TrashIcon className="size-3.5" />
				</button>
			</div>
		</div>
	);
}

export function ModelManager() {
	const { models, add } = useModels();

	return (
		<div className="space-y-2">
			<div className="rounded-xl border border-border divide-y divide-border">
				{models.map((m) => (
					<ModelRow key={m.id} entry={m} />
				))}
			</div>
			<AddModelRow onAdd={add} />
		</div>
	);
}

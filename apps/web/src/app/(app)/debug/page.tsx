"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ServiceStatus = {
	name: string;
	url: string;
	status: "online" | "offline" | "checking";
};

const SERVICES: Omit<ServiceStatus, "status">[] = [
	{ name: "Frontend", url: "http://localhost:3000" },
	{ name: "Backend API", url: "http://localhost:8787" },
	{ name: "PostgreSQL", url: "localhost:5433" },
	{ name: "Ollama", url: "http://localhost:11434" },
];

export default function DebugPage() {
	const [services, setServices] = useState<ServiceStatus[]>(
		SERVICES.map((s) => ({ ...s, status: "checking" })),
	);
	const [lastChecked, setLastChecked] = useState<Date | null>(null);

	const checkServices = async () => {
		setServices(SERVICES.map((s) => ({ ...s, status: "checking" })));

		const results = await Promise.all(
			SERVICES.map(async (service) => {
				try {
					if (service.name === "PostgreSQL") {
						// Can't directly ping Postgres from browser, check backend health instead
						const res = await fetch("http://localhost:8787/health", {
							signal: AbortSignal.timeout(3000),
						});
						return {
							...service,
							status: res.ok ? ("online" as const) : ("offline" as const),
						};
					}
					const _res = await fetch(service.url, {
						mode: "no-cors",
						signal: AbortSignal.timeout(3000),
					});
					return { ...service, status: "online" as const };
				} catch {
					return { ...service, status: "offline" as const };
				}
			}),
		);

		setServices(results);
		setLastChecked(new Date());
	};

	useEffect(() => {
		checkServices();
	}, [checkServices]);

	const statusColor = {
		online: "bg-emerald-400",
		offline: "bg-red-400",
		checking: "bg-amber-400 animate-pulse",
	};

	const statusText = {
		online: "text-emerald-400",
		offline: "text-red-400",
		checking: "text-amber-400",
	};

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 md:pt-[52px] pb-4">
			<div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold font-heading">Debug</h1>
						<p className="text-xs text-muted-foreground mt-1">
							System health and diagnostics.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={checkServices}
						className="gap-1.5 text-muted-foreground"
					>
						<ArrowClockwiseIcon className="size-3.5" />
						Refresh
					</Button>
				</div>

				{/* Service health */}
				<div className="rounded-xl border border-border overflow-hidden">
					<div className="px-4 py-3 border-b border-border flex items-center justify-between">
						<h2 className="text-sm font-medium">Services</h2>
						{lastChecked && (
							<span className="text-xs text-muted-foreground">
								Last checked {lastChecked.toLocaleTimeString()}
							</span>
						)}
					</div>
					{services.map((service, i) => (
						<div
							key={service.name}
							className={`flex items-center gap-4 px-4 py-3.5 ${i < services.length - 1 ? "border-b border-border" : ""}`}
						>
							<div
								className={`size-2.5 rounded-full ${statusColor[service.status]}`}
							/>
							<div className="flex-1">
								<p className="text-sm font-medium">{service.name}</p>
								<p className="text-xs text-muted-foreground font-mono">
									{service.url}
								</p>
							</div>
							<span
								className={`text-xs font-medium ${statusText[service.status]}`}
							>
								{service.status === "checking" ? "Checking..." : service.status}
							</span>
						</div>
					))}
				</div>

				{/* Environment */}
				<div className="rounded-xl border border-border p-4 space-y-3">
					<h2 className="text-sm font-medium">Environment</h2>
					<div className="space-y-2">
						{[
							[
								"Platform",
								typeof navigator !== "undefined" ? navigator.platform : "—",
							],
							[
								"User Agent",
								typeof navigator !== "undefined"
									? navigator.userAgent.split(" ").slice(-2).join(" ")
									: "—",
							],
							["Next.js", "16.1.6"],
							["React", "19.2.3"],
							["Node", process.env.NODE_ENV ?? "—"],
						].map(([key, value]) => (
							<div
								key={key}
								className="flex items-center justify-between text-xs"
							>
								<span className="text-muted-foreground">{key}</span>
								<span className="font-mono">{value}</span>
							</div>
						))}
					</div>
				</div>

				{/* Local storage */}
				<div className="rounded-xl border border-border p-4 space-y-3">
					<h2 className="text-sm font-medium">Local Storage</h2>
					<div className="space-y-2">
						{[
							"deimos-conversations",
							"deimos-settings",
							"deimos-memory",
							"deimos-projects",
							"deimos-models",
						].map((key) => {
							let size = "—";
							if (typeof localStorage !== "undefined") {
								const data = localStorage.getItem(key);
								if (data) {
									const bytes = new Blob([data]).size;
									size =
										bytes > 1024
											? `${(bytes / 1024).toFixed(1)} KB`
											: `${bytes} B`;
								} else {
									size = "empty";
								}
							}
							return (
								<div
									key={key}
									className="flex items-center justify-between text-xs"
								>
									<span className="text-muted-foreground font-mono">{key}</span>
									<span>{size}</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

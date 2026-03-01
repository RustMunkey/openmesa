"use client";

import {
	ArrowDownIcon,
	ArrowsClockwiseIcon,
	ArrowUpIcon,
	BookOpenTextIcon,
	BrainIcon,
	CaretUpDownIcon,
	CheckIcon,
	ClockIcon,
	CodeIcon,
	CopyIcon,
	ExportIcon,
	FileIcon,
	FolderIcon,
	GhostIcon,
	GlobeIcon,
	GlobeSimpleIcon,
	ImageIcon,
	LightbulbIcon,
	MagnifyingGlassIcon,
	PaperclipIcon,
	PencilSimpleIcon,
	PlusIcon,
	TerminalIcon,
	TranslateIcon,
	XIcon,
} from "@phosphor-icons/react";
import { Trio } from "ldrs/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import "ldrs/react/Trio.css";
import { toast } from "sonner";
import { Markdown } from "@/components/chat/markdown";
import { useSidebar } from "@/components/ui/sidebar";
import type { Message } from "@/lib/agent/types";
import { confirmAction, sendChat, type ToolCallEvent } from "@/lib/api";
import { useConversations } from "@/lib/store/conversations";
import { useGhost } from "@/lib/store/ghost";
import { DEFAULTS, useModels } from "@/lib/store/models";
import { useSettings } from "@/lib/store/settings";

const PROVIDER_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	ollama: "Ollama",
	openclaw: "OpenClaw",
};

const TOOL_ICONS: Record<string, typeof TerminalIcon> = {
	bash: TerminalIcon,
	read_file: FileIcon,
	write_file: FileIcon,
	list_dir: FolderIcon,
	search_files: MagnifyingGlassIcon,
	fetch_url: GlobeSimpleIcon,
	remember: BrainIcon,
	schedule: ClockIcon,
};

const RISK_LABELS: Record<string, string> = {
	safe: "Safe",
	standard: "Standard",
	elevated: "Requires approval",
	dangerous: "Dangerous",
	secret: "Contains secrets",
};

function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	const m = Math.floor(s / 60);
	const rem = Math.round(s % 60);
	return `${m}m ${rem}s`;
}

function MessageToolbar({
	msg,
	isLast,
	onCopy,
	onRegenerate,
	onExportPdf,
	onEdit,
	responseTimeMs,
}: {
	msg: Message;
	isLast: boolean;
	onCopy: () => void;
	onRegenerate: () => void;
	onExportPdf: () => void;
	onEdit: () => void;
	responseTimeMs?: number;
}) {
	const responseTime = responseTimeMs != null ? formatMs(responseTimeMs) : null;

	const btnClass =
		"flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer outline-none";

	if (msg.role === "user") {
		return (
			<div
				className={`flex justify-end gap-0.5 mt-1 ${isLast ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100"} transition-opacity duration-150`}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button" onClick={onCopy} className={btnClass}>
							<CopyIcon className="size-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Copy</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button" onClick={onEdit} className={btnClass}>
							<PencilSimpleIcon className="size-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Edit</TooltipContent>
				</Tooltip>
			</div>
		);
	}

	return (
		<div
			className={`flex items-center gap-0.5 mt-1 ${isLast ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100"} transition-opacity duration-150`}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" onClick={onRegenerate} className={btnClass}>
						<ArrowsClockwiseIcon className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">Regenerate</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" onClick={onCopy} className={btnClass}>
						<CopyIcon className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">Copy</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" onClick={onExportPdf} className={btnClass}>
						<ExportIcon className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">Export</TooltipContent>
			</Tooltip>
			{responseTime && (
				<span className="text-[11px] text-muted-foreground/50 ml-1">
					{responseTime}
				</span>
			)}
		</div>
	);
}

const MIN_ROWS = 4;
const MAX_ROWS = 8;
const LINE_HEIGHT = 20;

function cleanContent(content: string): string {
	if (!content) return content;
	const cleaned = content
		.replace(/\{"name":\s*"[^"]*",\s*"param(?:eters|s)":\s*\{[^}]*\}\}/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (!cleaned && content.trim()) return "*Executed a tool action.*";
	return cleaned;
}

type PendingToolCall = ToolCallEvent & {
	status: "pending" | "approved" | "denied" | "done";
	output?: string;
	error?: string | null;
};

function ToolCallCard({
	tc,
	onApprove,
	onDeny,
	isFocused,
}: {
	tc: PendingToolCall;
	onApprove: () => void;
	onDeny: () => void;
	isFocused: boolean;
}) {
	const Icon = TOOL_ICONS[tc.name] ?? TerminalIcon;

	useEffect(() => {
		if (!isFocused || tc.status !== "pending") return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				onApprove();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				onDeny();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isFocused, tc.status, onApprove, onDeny]);

	return (
		<div className="flex justify-start">
			<div
				className={`rounded-xl border p-3 text-sm space-y-2 ${tc.status === "pending" ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
			>
				<div className="flex items-center gap-2">
					<Icon className="size-4 text-muted-foreground shrink-0" />
					<span className="font-medium">{tc.name}</span>
					<span className="text-xs text-muted-foreground">
						{RISK_LABELS[tc.risk] ?? tc.risk}
					</span>
				</div>
				<code className="block text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-all">
					{tc.display}
				</code>
				{tc.secrets.length > 0 && (
					<p className="text-xs text-destructive">
						Contains: {tc.secrets.join(", ")}
					</p>
				)}
				{tc.status === "pending" && (
					<div className="flex items-center gap-2 pt-1">
						<Button size="sm" onClick={onApprove} className="gap-1.5">
							Allow
							<kbd className="text-[10px] opacity-60 ml-1 px-1 py-0.5 rounded bg-primary-foreground/20">
								↵
							</kbd>
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={onDeny}
							className="gap-1.5"
						>
							Deny
							<kbd className="text-[10px] opacity-60 ml-1 px-1 py-0.5 rounded bg-muted">
								esc
							</kbd>
						</Button>
					</div>
				)}
				{tc.status === "approved" && (
					<p className="text-xs text-primary">Approved — executing...</p>
				)}
				{tc.status === "denied" && (
					<p className="text-xs text-muted-foreground">Denied</p>
				)}
				{tc.status === "done" && (
					<div className="space-y-1">
						{tc.error && (
							<p className="text-xs text-destructive">Error: {tc.error}</p>
						)}
						{tc.output && (
							<pre className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
								{tc.output.slice(0, 500)}
								{tc.output.length > 500 ? "..." : ""}
							</pre>
						)}
						{!tc.error && !tc.output && (
							<p className="text-xs text-muted-foreground">Done</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// Generate a simple ID for ghost messages
let ghostMsgId = 0;
function makeGhostMessage(
	role: "user" | "assistant",
	content: string,
): Message {
	return {
		id: `ghost-${++ghostMsgId}`,
		role,
		content,
		createdAt: Date.now(),
	};
}

export default function ChatPage() {
	const _router = useRouter();
	const { models, selectedId, select } = useModels();
	const model =
		models.find((m) => m.id === selectedId) ?? models[0] ?? DEFAULTS[0];
	const [input, setInput] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const [hasFirstChunk, setHasFirstChunk] = useState(false);
	const [pendingTools, setPendingTools] = useState<PendingToolCall[]>([]);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [mounted, setMounted] = useState(false);
	const ghostMode = useGhost((s) => s.active);
	const setGhostActive = useGhost((s) => s.setActive);
	const [ghostMessages, setGhostMessages] = useState<Message[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const sidebar = useSidebar();
	const sidebarWasOpen = useRef(sidebar.open);
	const sendTimeRef = useRef<number>(0);
	const abortRef = useRef<AbortController | null>(null);
	const lastEscRef = useRef<number>(0);
	const [responseTimes, setResponseTimes] = useState<Record<string, number>>(
		{},
	);

	const scrollContainerCallback = useCallback((node: HTMLDivElement | null) => {
		scrollContainerRef.current = node;
	}, []);
	const {
		createConversation,
		appendMessage,
		updateLastMessage,
		getActive,
		activeId,
	} = useConversations();
	const { providers } = useSettings();

	useEffect(() => setMounted(true), []);

	// Sync ghost mode from URL on mount
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.has("ghost") && !ghostMode) {
			sidebarWasOpen.current = sidebar.open;
			if (sidebar.open) sidebar.setOpen(false);
			setGhostActive(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ghostMode, setGhostActive, sidebar.open, sidebar.setOpen]);

	const active = getActive();
	const persistedMessages = active?.messages ?? [];
	const messages = ghostMode ? ghostMessages : persistedMessages;
	const hasMessages = mounted && messages.length > 0;

	// Toggle ghost mode
	const toggleGhost = useCallback(() => {
		if (!ghostMode) {
			sidebarWasOpen.current = sidebar.open;
			if (sidebar.open) sidebar.setOpen(false);
			setGhostMessages([]);
			setPendingTools([]);
			setGhostActive(true);
			const url = new URL(window.location.href);
			url.searchParams.set("ghost", "");
			window.history.replaceState(
				null,
				"",
				url.toString().replace("ghost=", "ghost"),
			);
		} else {
			if (sidebarWasOpen.current) sidebar.setOpen(true);
			setGhostMessages([]);
			setPendingTools([]);
			setGhostActive(false);
			const url = new URL(window.location.href);
			url.searchParams.delete("ghost");
			window.history.replaceState(null, "", url.toString());
		}
	}, [ghostMode, sidebar, setGhostActive]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Track if user is scrolled to bottom
	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const handler = () => {
			const threshold = 80;
			const atBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
			setIsAtBottom(atBottom);
		};
		el.addEventListener("scroll", handler, { passive: true });
		return () => el.removeEventListener("scroll", handler);
	}, []);

	// Auto-scroll only if already at bottom
	useEffect(() => {
		if (isAtBottom) scrollToBottom();
	}, [isAtBottom, scrollToBottom]);

	const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
		const textarea = e.currentTarget;
		textarea.style.height = "auto";
		const maxHeight = MAX_ROWS * LINE_HEIGHT;
		textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
	};

	const resetTextarea = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleToolApprove = async (toolId: string) => {
		setPendingTools((prev) =>
			prev.map((t) => (t.id === toolId ? { ...t, status: "approved" } : t)),
		);
		await confirmAction(toolId, true);
	};

	const handleToolDeny = async (toolId: string) => {
		setPendingTools((prev) =>
			prev.map((t) => (t.id === toolId ? { ...t, status: "denied" } : t)),
		);
		await confirmAction(toolId, false);
	};

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || isThinking) return;

		const controller = new AbortController();
		abortRef.current = controller;

		if (ghostMode) {
			// Ghost mode: messages in component state only, no persistence
			const userMsg = makeGhostMessage("user", trimmed);
			const assistantMsg = makeGhostMessage("assistant", "");
			setGhostMessages((prev) => [...prev, userMsg, assistantMsg]);
			setInput("");
			resetTextarea();
			setIsThinking(true);
			setHasFirstChunk(false);
			setPendingTools([]);
			sendTimeRef.current = Date.now();

			const providerConfig = providers[model.provider];
			const chatMessages = [
				...ghostMessages.map((m) => ({
					role: m.role as "user" | "assistant",
					content: m.content,
				})),
				{ role: "user" as const, content: trimmed },
			];

			try {
				const response = await sendChat(chatMessages, {
					model: model.id,
					provider: model.provider,
					apiKey: providerConfig?.key,
					baseUrl: providerConfig?.url,
					signal: controller.signal,
					onChunk: (chunk) => {
						setHasFirstChunk(true);
						setGhostMessages((prev) => {
							const msgs = [...prev];
							const last = msgs[msgs.length - 1];
							if (last?.role === "assistant") {
								msgs[msgs.length - 1] = {
									...last,
									content: last.content + chunk,
								};
							}
							return msgs;
						});
					},
					onToolCall: (tc) => {
						setPendingTools((prev) => {
							if (prev.some((t) => t.id === tc.id)) return prev;
							const entry: PendingToolCall = {
								...tc,
								status: tc.requires_confirmation ? "pending" : "approved",
							};
							if (!tc.requires_confirmation) confirmAction(tc.id, true);
							return [...prev, entry];
						});
					},
					onToolResult: (result) => {
						setPendingTools((prev) =>
							prev.map((t) =>
								t.id === result.id
									? {
											...t,
											status: result.denied ? "denied" : "done",
											output: result.output,
											error: result.error,
										}
									: t,
							),
						);
					},
				});

				// If no streaming happened, set full response
				setGhostMessages((prev) => {
					const msgs = [...prev];
					const last = msgs[msgs.length - 1];
					if (last?.role === "assistant" && !last.content) {
						msgs[msgs.length - 1] = { ...last, content: response };
					}
					return msgs;
				});
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") {
					// Cancelled by user — leave partial content as-is
				} else {
					setGhostMessages((prev) => {
						const msgs = [...prev];
						const last = msgs[msgs.length - 1];
						if (last?.role === "assistant") {
							msgs[msgs.length - 1] = {
								...last,
								content: "*Error: Failed to get a response.*",
							};
						}
						return msgs;
					});
				}
			} finally {
				abortRef.current = null;
				setIsThinking(false);
				setResponseTimes((prev) => ({
					...prev,
					[assistantMsg.id]: Date.now() - sendTimeRef.current,
				}));
			}
			return;
		}

		// Normal mode: persisted conversation
		let convId = activeId;
		if (!convId) {
			const conv = createConversation(model.id, model.provider);
			convId = conv.id;
			window.history.replaceState(null, "", `/chat/${conv.id}`);
		}

		appendMessage(convId, { role: "user", content: trimmed });
		setInput("");
		resetTextarea();
		setIsThinking(true);
		setHasFirstChunk(false);
		setPendingTools([]);
		sendTimeRef.current = Date.now();

		appendMessage(convId, { role: "assistant", content: "" });

		const providerConfig = providers[model.provider];
		const chatMessages = [
			...persistedMessages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			})),
			{ role: "user" as const, content: trimmed },
		];

		try {
			const response = await sendChat(chatMessages, {
				model: model.id,
				provider: model.provider,
				apiKey: providerConfig?.key,
				baseUrl: providerConfig?.url,
				signal: controller.signal,
				onChunk: (chunk) => {
					setHasFirstChunk(true);
					// biome-ignore lint/style/noNonNullAssertion: convId is guaranteed set before this runs
					updateLastMessage(convId!, (prev) => prev + chunk);
				},
				onToolCall: (tc) => {
					setPendingTools((prev) => {
						if (prev.some((t) => t.id === tc.id)) return prev;
						const entry: PendingToolCall = {
							...tc,
							status: tc.requires_confirmation ? "pending" : "approved",
						};
						if (!tc.requires_confirmation) confirmAction(tc.id, true);
						return [...prev, entry];
					});
				},
				onToolResult: (result) => {
					setPendingTools((prev) =>
						prev.map((t) =>
							t.id === result.id
								? {
										...t,
										status: result.denied ? "denied" : "done",
										output: result.output,
										error: result.error,
									}
								: t,
						),
					);
				},
			});

			const current = useConversations
				.getState()
				.conversations.find((c) => c.id === convId);
			const lastMsg = current?.messages.at(-1);
			if (lastMsg?.role === "assistant" && !lastMsg.content) {
				// biome-ignore lint/style/noNonNullAssertion: convId is guaranteed set before this runs
				updateLastMessage(convId!, () => response);
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				// Cancelled by user — leave partial content as-is
			} else {
				updateLastMessage(
					// biome-ignore lint/style/noNonNullAssertion: convId is guaranteed set before this runs
					convId!,
					() =>
						"*Error: Failed to get a response. Check your connection and API keys.*",
				);
			}
		} finally {
			abortRef.current = null;
			setIsThinking(false);
			const current = useConversations
				.getState()
				.conversations.find((c) => c.id === convId);
			const lastAssistant = current?.messages.at(-1);
			if (lastAssistant) {
				setResponseTimes((prev) => ({
					...prev,
					[lastAssistant.id]: Date.now() - sendTimeRef.current,
				}));
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			const now = Date.now();
			if (isThinking && abortRef.current) {
				// Cancel in-flight request
				abortRef.current.abort();
				abortRef.current = null;
			} else if (now - lastEscRef.current < 400) {
				// Double-tap Escape: clear input
				setInput("");
				resetTextarea();
			}
			lastEscRef.current = now;
		}
	};

	const modelSelector = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="default"
					className="text-muted-foreground gap-1.5"
				>
					<span className="hidden sm:inline">{model.label}</span>
					<span className="sm:hidden text-xs">
						{model.label.length > 12
							? `${model.label.slice(0, 10)}…`
							: model.label}
					</span>
					<CaretUpDownIcon className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{models.map((m) => (
					<DropdownMenuItem key={m.id} onSelect={() => select(m.id)}>
						<div className="flex flex-1 items-center justify-between">
							<div className="flex flex-col">
								<span>{m.label}</span>
								<span className="text-xs text-muted-foreground">
									{PROVIDER_LABELS[m.provider]}
								</span>
							</div>
							{model.id === m.id && <CheckIcon className="size-4" />}
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div
			className={`relative flex flex-1 flex-col min-h-0 overflow-hidden ${ghostMode ? "bg-background" : ""}`}
		>
			{/* Action buttons — hidden on mobile, shown in MobileHeader instead */}
			<div className="absolute top-2 end-3 z-10 hidden md:flex flex-col items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={toggleGhost}
							className={`flex size-9 items-center justify-center cursor-pointer outline-none transition-colors ${
								ghostMode
									? "text-foreground hover:text-foreground/70"
									: "text-muted-foreground hover:text-accent-foreground"
							}`}
						>
							{ghostMode ? (
								<XIcon className="size-[22px]" weight="bold" />
							) : (
								<GhostIcon className="size-[22px]" />
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">
						{ghostMode ? "Exit ghost mode" : "Ghost mode"}
					</TooltipContent>
				</Tooltip>
			</div>

			{!hasMessages ? (
				<div className="flex flex-1 flex-col items-center justify-center px-3 sm:px-4 pb-16 sm:pb-24">
					{ghostMode ? (
						<GhostIcon
							className="size-12 text-muted-foreground mb-6"
							weight="fill"
						/>
					) : (
						<span
							className="font-versa text-foreground leading-none mb-6"
							style={{ fontSize: "48px" }}
						>
							DEIMOS
						</span>
					)}
					<div className="w-full max-w-2xl">
						<div
							className={`flex flex-col rounded-2xl border transition-colors ${
								ghostMode
									? "border-border bg-card focus-within:border-ring"
									: "border-border bg-background focus-within:border-foreground/20"
							}`}
						>
							<textarea
								ref={textareaRef}
								placeholder={
									ghostMode
										? "Ask anything — nothing is saved..."
										: "Ask anything..."
								}
								className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm leading-5 outline-none overflow-y-auto placeholder:text-muted-foreground"
								rows={MIN_ROWS}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onInput={handleInput}
								onKeyDown={handleKeyDown}
							/>
							<div className="flex items-center justify-between px-2 pb-2">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-foreground"
										>
											<PlusIcon className="size-5" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="min-w-44">
										<DropdownMenuItem>
											<PaperclipIcon className="size-4 mr-2" />
											Attach
										</DropdownMenuItem>
										<DropdownMenuItem>
											<ImageIcon className="size-4 mr-2" />
											Image
										</DropdownMenuItem>
										<DropdownMenuItem>
											<GlobeIcon className="size-4 mr-2" />
											Search
										</DropdownMenuItem>
										<DropdownMenuItem>
											<MagnifyingGlassIcon className="size-4 mr-2" />
											Research
										</DropdownMenuItem>
										<DropdownMenuItem>
											<LightbulbIcon className="size-4 mr-2" />
											Reason
										</DropdownMenuItem>
										<DropdownMenuItem>
											<BrainIcon className="size-4 mr-2" />
											Think
										</DropdownMenuItem>
										<DropdownMenuItem>
											<CodeIcon className="size-4 mr-2" />
											Code
										</DropdownMenuItem>
										<DropdownMenuItem>
											<PencilSimpleIcon className="size-4 mr-2" />
											Write
										</DropdownMenuItem>
										<DropdownMenuItem>
											<TranslateIcon className="size-4 mr-2" />
											Translate
										</DropdownMenuItem>
										<DropdownMenuItem>
											<BookOpenTextIcon className="size-4 mr-2" />
											Summarize
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<div className="flex items-center gap-1.5">
									{modelSelector}
									<Button
										size="icon"
										className="rounded-full"
										onClick={handleSend}
									>
										<ArrowUpIcon className="size-5" weight="bold" />
									</Button>
								</div>
							</div>
						</div>

						{ghostMode && (
							<p className="mt-3 text-center text-xs text-muted-foreground">
								Your conversations here are private — nothing is saved, stored,
								or used to improve models.
							</p>
						)}
					</div>
				</div>
			) : (
				<div className="relative flex flex-1 flex-col min-h-0">
					<div
						ref={scrollContainerCallback}
						className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6"
					>
						<div className="mx-auto max-w-2xl space-y-6">
							{messages.map((msg, i) => {
								const cleaned = cleanContent(msg.content);
								if (!cleaned && msg.role === "assistant") return null;
								const isLastMsg =
									i === messages.length - 1 ||
									(i === messages.length - 2 &&
										messages[messages.length - 1]?.role === "assistant" &&
										!cleanContent(messages[messages.length - 1].content));
								return (
									<div
										key={msg.id}
										className={`group/msg ${msg.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}`}
									>
										<div
											className={
												msg.role === "user"
													? `max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-primary text-primary-foreground`
													: "max-w-[90%] sm:max-w-[80%] rounded-2xl text-sm"
											}
										>
											{msg.role === "user" ? (
												<p className="whitespace-pre-wrap">{cleaned}</p>
											) : (
												<Markdown content={cleaned} />
											)}
										</div>
										<MessageToolbar
											msg={msg}
											isLast={isLastMsg}
											onCopy={() => {
												navigator.clipboard.writeText(msg.content);
												toast.success("Copied to clipboard");
											}}
											onRegenerate={() => {
												// TODO: regenerate response
												toast("Regenerate coming soon");
											}}
											onExportPdf={() => {
												const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Response</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#1a1a1a;font-size:14px;line-height:1.7}p{white-space:pre-wrap}</style></head><body><p>${msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></body></html>`;
												const w = window.open("", "_blank");
												if (w) {
													w.document.write(html);
													w.document.close();
													w.print();
												}
											}}
											onEdit={() => {
												setInput(msg.content);
												textareaRef.current?.focus();
											}}
											responseTimeMs={responseTimes[msg.id]}
										/>
									</div>
								);
							})}
							{pendingTools.map((tc) => {
								const lastPending = pendingTools
									.filter((t) => t.status === "pending")
									.at(-1);
								return (
									<ToolCallCard
										key={tc.id}
										tc={tc}
										isFocused={tc.id === lastPending?.id}
										onApprove={() => handleToolApprove(tc.id)}
										onDeny={() => handleToolDeny(tc.id)}
									/>
								);
							})}
							{isThinking && !hasFirstChunk && (
								<div className="flex justify-start">
									<div className="flex items-center gap-3 rounded-2xl py-3 text-sm text-muted-foreground">
										<Trio size="20" speed="1.3" color="currentColor" />
										<span>Thinking...</span>
									</div>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
					</div>

					<div className="shrink-0 px-3 sm:px-4 py-3 bg-background">
						<div className="mx-auto max-w-2xl relative">
							{/* Jump to latest */}
							{!isAtBottom && hasMessages && (
								<button
									type="button"
									onClick={scrollToBottom}
									className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 cursor-pointer outline-none shadow-sm transition-colors"
								>
									<ArrowDownIcon className="size-3" weight="bold" />
									Latest
								</button>
							)}
							<div
								className={`flex flex-col rounded-2xl border transition-colors ${
									ghostMode
										? "border-border bg-card focus-within:border-ring"
										: "border-border focus-within:border-foreground/20"
								}`}
							>
								<textarea
									ref={textareaRef}
									placeholder={
										ghostMode
											? "Ask anything — nothing is saved..."
											: "Ask anything..."
									}
									className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm leading-5 outline-none overflow-y-auto placeholder:text-muted-foreground"
									rows={2}
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onInput={handleInput}
									onKeyDown={handleKeyDown}
								/>
								<div className="flex items-center justify-between px-2 pb-2">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="text-muted-foreground hover:text-foreground"
											>
												<PlusIcon className="size-5" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="min-w-44">
											<DropdownMenuItem>
												<PaperclipIcon className="size-4 mr-2" />
												Attach
											</DropdownMenuItem>
											<DropdownMenuItem>
												<ImageIcon className="size-4 mr-2" />
												Image
											</DropdownMenuItem>
											<DropdownMenuItem>
												<GlobeIcon className="size-4 mr-2" />
												Search
											</DropdownMenuItem>
											<DropdownMenuItem>
												<MagnifyingGlassIcon className="size-4 mr-2" />
												Research
											</DropdownMenuItem>
											<DropdownMenuItem>
												<LightbulbIcon className="size-4 mr-2" />
												Reason
											</DropdownMenuItem>
											<DropdownMenuItem>
												<BrainIcon className="size-4 mr-2" />
												Think
											</DropdownMenuItem>
											<DropdownMenuItem>
												<CodeIcon className="size-4 mr-2" />
												Code
											</DropdownMenuItem>
											<DropdownMenuItem>
												<PencilSimpleIcon className="size-4 mr-2" />
												Write
											</DropdownMenuItem>
											<DropdownMenuItem>
												<TranslateIcon className="size-4 mr-2" />
												Translate
											</DropdownMenuItem>
											<DropdownMenuItem>
												<BookOpenTextIcon className="size-4 mr-2" />
												Summarize
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
									<div className="flex items-center gap-1.5">
										{modelSelector}
										<Button
											size="icon"
											className="rounded-full"
											onClick={handleSend}
											disabled={isThinking}
										>
											<ArrowUpIcon className="size-5" weight="bold" />
										</Button>
									</div>
								</div>
							</div>
							<p className="mt-2 text-center text-xs text-muted-foreground">
								{ghostMode
									? "Off the record — no history, no memory, no trace."
									: "Deimos can make mistakes. Double-check important information."}
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

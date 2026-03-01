"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
			className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
		>
			{copied ? (
				<>
					<CheckIcon className="size-3.5" />
					Copied
				</>
			) : (
				<>
					<CopyIcon className="size-3.5" />
					Copy
				</>
			)}
		</button>
	);
}

export function Markdown({ content }: { content: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				p: ({ children }) => (
					<p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
				),
				strong: ({ children }) => (
					<strong className="font-semibold">{children}</strong>
				),
				em: ({ children }) => <em className="italic">{children}</em>,
				h1: ({ children }) => (
					<h1 className="text-lg font-semibold mt-5 mb-2 font-heading">
						{children}
					</h1>
				),
				h2: ({ children }) => (
					<h2 className="text-base font-semibold mt-4 mb-2 font-heading">
						{children}
					</h2>
				),
				h3: ({ children }) => (
					<h3 className="text-sm font-semibold mt-3 mb-1.5 font-heading">
						{children}
					</h3>
				),
				ul: ({ children }) => (
					<ul className="mb-3 last:mb-0 list-disc pl-5 space-y-1">
						{children}
					</ul>
				),
				ol: ({ children }) => (
					<ol className="mb-3 last:mb-0 list-decimal pl-5 space-y-1">
						{children}
					</ol>
				),
				li: ({ children }) => <li className="leading-relaxed">{children}</li>,
				blockquote: ({ children }) => (
					<blockquote className="border-l-2 border-primary/40 pl-3 my-3 text-muted-foreground italic">
						{children}
					</blockquote>
				),
				a: ({ href, children }) => (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary underline underline-offset-2 hover:text-primary/80"
					>
						{children}
					</a>
				),
				hr: () => <hr className="my-4 border-border" />,
				table: ({ children }) => (
					<div className="my-3 overflow-x-auto rounded-lg border border-border">
						<table className="w-full text-sm">{children}</table>
					</div>
				),
				thead: ({ children }) => (
					<thead className="bg-muted/50 border-b border-border">
						{children}
					</thead>
				),
				th: ({ children }) => (
					<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="px-3 py-2 border-t border-border">{children}</td>
				),
				code: ({ className, children }) => {
					const match = /language-(\w+)/.exec(className || "");
					const codeString = String(children).replace(/\n$/, "");

					if (match) {
						return (
							<div className="my-3 rounded-lg border border-border overflow-hidden">
								<div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b border-border">
									<span className="text-[11px] text-muted-foreground">
										{match[1]}
									</span>
									<CopyButton text={codeString} />
								</div>
								<pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
									<code>{children}</code>
								</pre>
							</div>
						);
					}

					// Inline code
					return (
						<code className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[13px]">
							{children}
						</code>
					);
				},
				pre: ({ children }) => <>{children}</>,
			}}
		>
			{content}
		</ReactMarkdown>
	);
}

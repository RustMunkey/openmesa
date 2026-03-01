"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
	Conversation,
	Message,
	ProviderId,
	ToolCall,
} from "@/lib/agent/types";
import { generateTitle } from "@/lib/generate-title";

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type ConversationsState = {
	conversations: Conversation[];
	activeId: string | null;
	getActive: () => Conversation | undefined;
	createConversation: (model: string, provider: ProviderId) => Conversation;
	appendMessage: (
		id: string,
		message: Omit<Message, "id" | "createdAt">,
	) => void;
	updateTitle: (id: string, title: string) => void;
	updateLastMessage: (
		id: string,
		content: string | ((prev: string) => string),
	) => void;
	upsertToolCall: (
		conversationId: string,
		toolCall: Partial<ToolCall> & { id: string },
	) => void;
	removeConversation: (id: string) => void;
	setActive: (id: string | null) => void;
};

export const useConversations = create<ConversationsState>()(
	persist(
		(set, get) => ({
			conversations: [],
			activeId: null,

			getActive: () => {
				const { conversations, activeId } = get();
				return conversations.find((c) => c.id === activeId);
			},

			createConversation: (model, provider) => {
				const conversation: Conversation = {
					id: genId(),
					title: "New conversation",
					messages: [],
					model,
					provider,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};
				set((s) => ({
					conversations: [conversation, ...s.conversations],
					activeId: conversation.id,
				}));
				return conversation;
			},

			appendMessage: (id, message) => {
				const msg: Message = { ...message, id: genId(), createdAt: Date.now() };
				const isFirstUserMessage =
					message.role === "user" &&
					get().conversations.find((c) => c.id === id)?.messages.length === 0;

				set((s) => ({
					conversations: s.conversations.map((c) => {
						if (c.id !== id) return c;
						return {
							...c,
							messages: [...c.messages, msg],
							updatedAt: Date.now(),
						};
					}),
				}));

				if (isFirstUserMessage) {
					generateTitle(message.content).then((title) => {
						get().updateTitle(id, title);
					});
				}
			},

			updateLastMessage: (id, content) => {
				set((s) => ({
					conversations: s.conversations.map((c) => {
						if (c.id !== id) return c;
						const messages = [...c.messages];
						const last = messages.at(-1);
						if (!last || last.role !== "assistant") return c;
						const newContent =
							typeof content === "function" ? content(last.content) : content;
						messages[messages.length - 1] = { ...last, content: newContent };
						return { ...c, messages, updatedAt: Date.now() };
					}),
				}));
			},

			upsertToolCall: (conversationId, patch) => {
				set((s) => ({
					conversations: s.conversations.map((c) => {
						if (c.id !== conversationId) return c;
						const messages = [...c.messages];
						const lastAssistantIdx = messages.findLastIndex(
							(m) => m.role === "assistant",
						);
						if (lastAssistantIdx === -1) return c;
						const msg = { ...messages[lastAssistantIdx] };
						const existing = msg.toolCalls ?? [];
						const idx = existing.findIndex((t) => t.id === patch.id);
						if (idx >= 0) {
							msg.toolCalls = existing.map((t, i) =>
								i === idx ? { ...t, ...patch } : t,
							);
						} else {
							msg.toolCalls = [...existing, patch as ToolCall];
						}
						messages[lastAssistantIdx] = msg;
						return { ...c, messages, updatedAt: Date.now() };
					}),
				}));
			},

			updateTitle: (id, title) => {
				set((s) => ({
					conversations: s.conversations.map((c) =>
						c.id === id ? { ...c, title } : c,
					),
				}));
			},

			removeConversation: (id) => {
				set((s) => ({
					conversations: s.conversations.filter((c) => c.id !== id),
					activeId: s.activeId === id ? null : s.activeId,
				}));
			},

			setActive: (id) => set({ activeId: id }),
		}),
		{
			name: "deimos-conversations",
			partialize: (state) => ({
				conversations: state.conversations,
			}),
			merge: (persisted, current) => ({
				...current,
				...(persisted as Record<string, unknown>),
				activeId: null,
			}),
		},
	),
);

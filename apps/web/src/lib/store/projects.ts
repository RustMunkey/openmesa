"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export type Project = {
	id: string;
	name: string;
	description: string;
	conversationIds: string[];
	archived: boolean;
	createdAt: number;
	updatedAt: number;
};

type ProjectsState = {
	projects: Project[];
	createProject: (name: string, description?: string) => Project;
	removeProject: (id: string) => void;
	renameProject: (id: string, name: string) => void;
	addConversation: (projectId: string, conversationId: string) => void;
	removeConversation: (projectId: string, conversationId: string) => void;
	archiveProject: (id: string) => void;
	unarchiveProject: (id: string) => void;
};

export const useProjects = create<ProjectsState>()(
	persist(
		(set, _get) => ({
			projects: [],

			createProject: (name, description = "") => {
				const project: Project = {
					id: genId(),
					name,
					description,
					conversationIds: [],
					archived: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};
				set((s) => ({ projects: [project, ...s.projects] }));
				return project;
			},

			removeProject: (id) => {
				set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
			},

			renameProject: (id, name) => {
				set((s) => ({
					projects: s.projects.map((p) =>
						p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
					),
				}));
			},

			addConversation: (projectId, conversationId) => {
				set((s) => ({
					projects: s.projects.map((p) =>
						p.id === projectId
							? {
									...p,
									conversationIds: [...p.conversationIds, conversationId],
									updatedAt: Date.now(),
								}
							: p,
					),
				}));
			},

			removeConversation: (projectId, conversationId) => {
				set((s) => ({
					projects: s.projects.map((p) =>
						p.id === projectId
							? {
									...p,
									conversationIds: p.conversationIds.filter(
										(id) => id !== conversationId,
									),
									updatedAt: Date.now(),
								}
							: p,
					),
				}));
			},
			archiveProject: (id) => {
				set((s) => ({
					projects: s.projects.map((p) =>
						p.id === id ? { ...p, archived: true, updatedAt: Date.now() } : p,
					),
				}));
			},

			unarchiveProject: (id) => {
				set((s) => ({
					projects: s.projects.map((p) =>
						p.id === id ? { ...p, archived: false, updatedAt: Date.now() } : p,
					),
				}));
			},
		}),
		{ name: "deimos-projects" },
	),
);

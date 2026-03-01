"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useConversations } from "@/lib/store/conversations";
import ChatPage from "../page";

export default function ChatByIdPage() {
	const { id } = useParams<{ id: string }>();
	const { setActive } = useConversations();

	useEffect(() => {
		setActive(id);
		return () => setActive(null);
	}, [id, setActive]);

	return <ChatPage />;
}

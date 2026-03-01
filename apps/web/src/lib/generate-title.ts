/**
 * Generate a short, contextual title for a conversation based on the first message.
 *
 * TODO: Replace mock with actual AI call when backend is wired up.
 * Expected: POST /api/title { message: string } → { title: string }
 */
export async function generateTitle(message: string): Promise<string> {
	// --- AI call goes here ---
	// const res = await fetch("/api/title", {
	//   method: "POST",
	//   headers: { "Content-Type": "application/json" },
	//   body: JSON.stringify({ message }),
	// })
	// const { title } = await res.json()
	// return title
	// -------------------------

	// Mock: extract a concise title from the message
	const cleaned = message.replace(/\n+/g, " ").trim();

	if (cleaned.length <= 40) return cleaned;

	// Try to cut at a natural boundary
	const truncated = cleaned.slice(0, 40);
	const lastSpace = truncated.lastIndexOf(" ");
	return lastSpace > 20
		? `${truncated.slice(0, lastSpace)}...`
		: `${truncated}...`;
}

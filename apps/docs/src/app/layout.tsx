import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import "fumadocs-ui/style.css";

export const metadata: Metadata = {
	title: "OpenMesa Docs",
	description: "Documentation for the OpenMesa API and platform.",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}

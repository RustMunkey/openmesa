import type { Metadata, Viewport } from "next";
import {
	DM_Sans,
	DM_Serif_Display,
	Geist_Mono,
	Space_Grotesk,
	Space_Mono,
} from "next/font/google";
import Script from "next/script";
import { PaletteProvider } from "@/components/palette-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TypographyProvider } from "@/components/typography-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
	variable: "--font-space-grotesk",
	subsets: ["latin"],
});

const dmSans = DM_Sans({
	variable: "--font-dm-sans",
	subsets: ["latin"],
});

const spaceMono = Space_Mono({
	variable: "--font-space-mono",
	subsets: ["latin"],
	weight: ["400", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
	variable: "--font-dm-serif",
	subsets: ["latin"],
	weight: "400",
});

export const metadata: Metadata = {
	title: "Deimos – Personal AI Agent",
	description: "Autonomous AI agent",
	icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistMono.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${dmSerifDisplay.variable} ${dmSans.variable} antialiased`}
			>
				<Script
					id="typography-init"
					strategy="beforeInteractive"
				>{`try{document.documentElement.setAttribute('data-font',localStorage.getItem('deimos-typography')||'mono')}catch(e){}`}</Script>
				<Script
					id="palette-init"
					strategy="beforeInteractive"
				>{`try{document.documentElement.setAttribute('data-palette',localStorage.getItem('deimos-palette')||'mars')}catch(e){}`}</Script>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					storageKey="deimos-theme"
					themes={["dark", "light", "system"]}
				>
					<TypographyProvider />
					<PaletteProvider />
					<TooltipProvider>
						{children}
						<Toaster position="top-center" />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}

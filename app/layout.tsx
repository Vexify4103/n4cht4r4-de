import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: "N4cht4r4 · Community Garden",
		template: "%s · N4cht4r4",
	},
	description: "Nachtaras Community Garden für Streams, Turniere, Challenges, gemeinsame Spielprojekte und Community-Kunst.",
	icons: {
		icon: [
			{ url: "/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon.png", type: "image/png" },
		],
	},
	openGraph: {
		title: "N4cht4r4 · Community Garden",
		description: "Streams, Turniere, Challenges und Community-Projekte unter Kirschblüten.",
		type: "website",
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="de" suppressHydrationWarning>
			<SessionProvider refetchInterval={0} refetchOnWindowFocus={false} refetchWhenOffline={false}>
				<SiteShell>{children}</SiteShell>
			</SessionProvider>
		</html>
	);
}

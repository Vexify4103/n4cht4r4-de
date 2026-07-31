import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "cdn.discordapp.com" },
			{ protocol: "https", hostname: "media.discordapp.net" },
			{ protocol: "https", hostname: "static-cdn.jtvnw.net" },
			{ protocol: "https", hostname: "clips-media-assets2.twitch.tv" },
			{ protocol: "https", hostname: "**.twitch.tv" },
			{ protocol: "https", hostname: "ddragon.leagueoflegends.com" },
		],
	},
	async redirects() {
		return [
			{ source: "/turnier", destination: "/tournaments", permanent: true },
			{ source: "/turnier/:path*", destination: "/tournaments/:path*", permanent: true },
		];
	},
};

export default nextConfig;

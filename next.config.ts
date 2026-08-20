import type { NextConfig } from "next";

const securityHeaders = [
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Cross-Origin-Resource-Policy", value: "same-origin" },
	{ key: "X-Permitted-Cross-Domain-Policies", value: "none" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
	...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	experimental: {
		sri: { algorithm: "sha384" },
	},
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
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
			{
				source: "/api/:path*",
				headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" }],
			},
		];
	},
};

export default nextConfig;

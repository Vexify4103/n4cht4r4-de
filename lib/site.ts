export const site = {
	name: "N4cht4r4",
	discordUrl: "https://discord.gg/g69uYP97Qh",
	twitchUrl: "https://www.twitch.tv/n4cht4r4",
	koFiUrl: "https://ko-fi.com/n4cht4r4",
	tiktokUrl: "https://www.tiktok.com/@twitchn4cht4r4",
	instagramUrl: "https://www.instagram.com/n4cht4r4",
	youtubeUrl: "https://www.youtube.com/@n4cht4r4",
	xUrl: "https://x.com/n4cht4r4",
	amazonWishlistUrl: process.env.NEXT_PUBLIC_AMAZON_WISHLIST_URL?.trim() || null,
	creator: {
		name: process.env.NEXT_PUBLIC_CREATOR_NAME?.trim() || "vexi",
		discordUrl: process.env.NEXT_PUBLIC_CREATOR_DISCORD_URL?.trim() || "https://discord.gg/g69uYP97Qh",
		twitchUrl: process.env.NEXT_PUBLIC_CREATOR_TWITCH_URL?.trim() || "https://www.twitch.tv/vexi_fy",
	},
} as const;

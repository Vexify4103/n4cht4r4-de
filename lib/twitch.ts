const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;

export async function fetchTwitchSchedule(broadcasterId: string) {
	if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) {
		return null;
	}

	try {
		const res = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${broadcasterId}`, {
			headers: {
				"Client-ID": TWITCH_CLIENT_ID,
				Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`,
			},
			next: { revalidate: 300 },
		});

		if (!res.ok) return null;
		const data = await res.json();
		return data.data?.segments ?? [];
	} catch {
		return null;
	}
}

export async function fetchTwitchUser(login: string) {
	if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) {
		return null;
	}

	try {
		const res = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
			headers: {
				"Client-ID": TWITCH_CLIENT_ID,
				Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`,
			},
			next: { revalidate: 3600 },
		});

		if (!res.ok) return null;
		const data = await res.json();
		return data.data?.[0] ?? null;
	} catch {
		return null;
	}
}

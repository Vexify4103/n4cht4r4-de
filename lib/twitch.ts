import { hasTwitchApiCredentials, twitchApiFetch } from "@/lib/twitch-api";

export async function fetchTwitchSchedule(broadcasterId: string) {
	if (!hasTwitchApiCredentials()) {
		return null;
	}

	try {
		const res = await twitchApiFetch(`/schedule?broadcaster_id=${broadcasterId}`, {
			next: { revalidate: 300 },
		});

		if (!res?.ok) return null;
		const data = await res.json();
		return data.data?.segments ?? [];
	} catch {
		return null;
	}
}

export async function fetchTwitchUser(login: string) {
	if (!hasTwitchApiCredentials()) {
		return null;
	}

	try {
		const res = await twitchApiFetch(`/users?login=${encodeURIComponent(login)}`, {
			next: { revalidate: 3600 },
		});

		if (!res?.ok) return null;
		const data = await res.json();
		return data.data?.[0] ?? null;
	} catch {
		return null;
	}
}

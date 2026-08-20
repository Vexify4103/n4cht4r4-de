const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type NextFetchOptions = RequestInit & {
	next?: { revalidate?: number };
};

type TwitchAppTokenResponse = {
	access_token?: string;
	expires_in?: number;
};

let activeAccessToken = process.env.TWITCH_ACCESS_TOKEN?.trim() || null;
let activeAccessTokenExpiresAt = 0;
let tokenRequest: Promise<string | null> | null = null;

function twitchClientId() {
	return process.env.TWITCH_CLIENT_ID?.trim() || null;
}

function twitchClientSecret() {
	const directSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
	if (directSecret) return directSecret;

	const clientId = twitchClientId();
	const authClientId = process.env.AUTH_TWITCH_ID?.trim();
	if (clientId && authClientId === clientId) return process.env.AUTH_TWITCH_SECRET?.trim() || null;
	return null;
}

export function hasTwitchApiCredentials() {
	return Boolean(twitchClientId() && (activeAccessToken || twitchClientSecret()));
}

async function requestAppAccessToken() {
	const clientId = twitchClientId();
	const clientSecret = twitchClientSecret();
	if (!clientId || !clientSecret) return null;

	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: "client_credentials",
	});
	const response = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		cache: "no-store",
	}).catch(() => null);

	if (!response?.ok) {
		console.error(`[Twitch] App access token refresh failed${response ? ` (${response.status})` : ""}.`);
		return null;
	}

	const payload = (await response.json()) as TwitchAppTokenResponse;
	if (!payload.access_token) {
		console.error("[Twitch] App access token response did not contain a token.");
		return null;
	}

	activeAccessToken = payload.access_token;
	activeAccessTokenExpiresAt = Date.now() + Math.max(0, Number(payload.expires_in || 0) * 1000);
	console.log("[Twitch] App access token refreshed.");
	return activeAccessToken;
}

async function getAccessToken() {
	if (activeAccessToken && (!activeAccessTokenExpiresAt || activeAccessTokenExpiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS)) {
		return activeAccessToken;
	}

	if (!tokenRequest) {
		tokenRequest = requestAppAccessToken().finally(() => {
			tokenRequest = null;
		});
	}
	return tokenRequest;
}

export async function twitchApiFetch(path: string, options: NextFetchOptions = {}) {
	const clientId = twitchClientId();
	const accessToken = await getAccessToken();
	if (!clientId || !accessToken) return null;

	const request = (token: string) => {
		const headers = new Headers(options.headers);
		headers.set("Client-ID", clientId);
		headers.set("Authorization", `Bearer ${token}`);
		return fetch(`${TWITCH_API_BASE}${path}`, { ...options, headers }).catch(() => null);
	};

	const response = await request(accessToken);
	if (response?.status !== 401) return response;

	if (accessToken === activeAccessToken) {
		activeAccessToken = null;
		activeAccessTokenExpiresAt = 0;
	}
	const refreshedToken = await getAccessToken();
	if (!refreshedToken) return response;
	return request(refreshedToken);
}

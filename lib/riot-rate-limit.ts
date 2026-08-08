type RiotBucket = {
	limit: number;
	count: number;
	windowMs: number;
	startedAt: number;
};

const buckets = new Map<string, RiotBucket>();
let requestChain: Promise<unknown> = Promise.resolve();
let blockedUntil = 0;
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 75;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function parsePairs(value: string | null) {
	const pairs = new Map<number, number>();
	for (const part of (value || "").split(",")) {
		const [rawValue, rawWindow] = part.trim().split(":");
		const parsedValue = Number(rawValue);
		const windowSeconds = Number(rawWindow);
		if (Number.isFinite(parsedValue) && Number.isFinite(windowSeconds)) pairs.set(windowSeconds, parsedValue);
	}
	return pairs;
}

function updateBuckets(response: Response, scope: "app" | "method") {
	const prefix = scope === "app" ? "X-App-Rate-Limit" : "X-Method-Rate-Limit";
	const limits = parsePairs(response.headers.get(prefix));
	const counts = parsePairs(response.headers.get(`${prefix}-Count`));
	const now = Date.now();
	for (const [windowSeconds, limit] of limits) {
		const key = `${scope}:${windowSeconds}`;
		const existing = buckets.get(key);
		const windowMs = windowSeconds * 1_000;
		buckets.set(key, {
			limit,
			count: counts.get(windowSeconds) || 0,
			windowMs,
			startedAt: existing && now - existing.startedAt < windowMs ? existing.startedAt : now,
		});
	}
}

async function waitForCapacity() {
	const now = Date.now();
	let waitUntil = Math.max(blockedUntil, lastRequestAt + MIN_REQUEST_GAP_MS);
	for (const bucket of buckets.values()) {
		if (now - bucket.startedAt >= bucket.windowMs) {
			bucket.startedAt = now;
			bucket.count = 0;
		}
		if (bucket.count >= bucket.limit - 1) waitUntil = Math.max(waitUntil, bucket.startedAt + bucket.windowMs + 100);
	}
	if (waitUntil > now) await sleep(waitUntil - now);
}

async function performRiotRequest(url: string, init: RequestInit, attempt = 0): Promise<Response> {
	await waitForCapacity();
	lastRequestAt = Date.now();
	const response = await fetch(url, init).catch(() => null);
	if (!response) {
		if (attempt < 3) {
			await sleep(1_000 * 2 ** attempt);
			return performRiotRequest(url, init, attempt + 1);
		}
		throw new Error("Riot API is unavailable.");
	}
	updateBuckets(response, "app");
	updateBuckets(response, "method");
	if (response.status === 429 && attempt < 4) {
		const retrySeconds = Number(response.headers.get("Retry-After") || 1);
		blockedUntil = Date.now() + Math.max(1, retrySeconds) * 1_000;
		await sleep(blockedUntil - Date.now());
		return performRiotRequest(url, init, attempt + 1);
	}
	if (response.status >= 500 && attempt < 3) {
		await sleep(1_000 * 2 ** attempt);
		return performRiotRequest(url, init, attempt + 1);
	}
	return response;
}

export function riotApiFetch(url: string, init: RequestInit = {}) {
	const run = () => performRiotRequest(url, init);
	const result = requestChain.then(run, run);
	requestChain = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

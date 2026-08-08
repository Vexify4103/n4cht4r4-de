import client from "@/lib/db";
import { processNextRiotSyncJob } from "@/lib/riot-sync-queue";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
	if (running) return;
	running = true;
	try {
		await client.connect();
		await processNextRiotSyncJob(client.db());
	} catch (error) {
		console.error("Riot sync worker failed:", error);
	} finally {
		running = false;
	}
}

export function startRiotWorker() {
	if (timer) return;
	void tick();
	timer = setInterval(() => void tick(), 5_000);
	timer.unref();
}

export function stopRiotWorker() {
	if (timer) clearInterval(timer);
	timer = null;
}

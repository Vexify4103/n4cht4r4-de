import client from "@/lib/db";
import { processNextDiscordQueueJob } from "@/lib/discord-queue";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
	if (running) return;
	running = true;
	try {
		await client.connect();
		await processNextDiscordQueueJob(client.db());
	} catch (error) {
		console.error("Discord queue worker failed:", error);
	} finally {
		running = false;
	}
}

export function startDiscordWorker() {
	if (timer) return;
	void tick();
	timer = setInterval(() => void tick(), 2_500);
	timer.unref();
}

export function stopDiscordWorker() {
	if (timer) clearInterval(timer);
	timer = null;
}

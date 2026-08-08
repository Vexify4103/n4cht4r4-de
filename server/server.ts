import { createServer } from "node:http";
import next from "next";
import { startDiscordWorker, stopDiscordWorker } from "./discord-worker";

const development = process.env.NODE_ENV !== "production";
const hostname = process.env.APP_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3001);
const nextApp = next({ dev: development, hostname, port, dir: process.cwd() });
const handler = nextApp.getRequestHandler();

async function start() {
	await nextApp.prepare();
	const server = createServer((request, response) => handler(request, response));
	if (process.env.RUN_BACKGROUND_WORKER !== "false") startDiscordWorker();

	server.listen(port, hostname, () => {
		console.log(`N4cht4r4 website listening on http://${hostname}:${port}`);
	});

	function shutdown(signal: string) {
		console.log(`Received ${signal}; shutting down.`);
		stopDiscordWorker();
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(1), 10_000).unref();
	}

	process.once("SIGINT", () => shutdown("SIGINT"));
	process.once("SIGTERM", () => shutdown("SIGTERM"));
}

void start().catch((error) => {
	console.error("N4cht4r4 server failed to prepare:", error);
	process.exit(1);
});

import client from "@/lib/db";
import { processNextDiscordQueueJob } from "@/lib/discord-queue";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function processQueue(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	await client.connect();
	const result = await processNextDiscordQueueJob(client.db());
	return NextResponse.json(result);
}

export async function GET(request: Request) {
	return processQueue(request);
}

export async function POST(request: Request) {
	return processQueue(request);
}

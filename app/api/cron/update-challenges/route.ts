import { NextResponse } from "next/server";
import client from "@/lib/db";
import { enqueueRiotChallengeSync } from "@/lib/riot-sync-queue";

export const runtime = "nodejs";

export async function GET(request: Request) {
	if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	await client.connect();
	const db = client.db();
	const users = await db
		.collection("users")
		.find({ riotPuuid: { $exists: true, $ne: null } })
		.toArray();
	const jobs = await Promise.all(users.map((user) => enqueueRiotChallengeSync(db, user._id.toString(), String(user.riotPuuid), 30)));
	return NextResponse.json({ usersFound: users.length, jobsQueued: jobs.filter((entry) => entry.created).length, alreadyQueued: jobs.filter((entry) => !entry.created).length });
}

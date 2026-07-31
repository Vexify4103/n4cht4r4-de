import { NextResponse } from "next/server";
import client from "@/lib/db";
import { syncRiotChallengesForUser } from "@/lib/riot-challenge-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
	if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	await client.connect();
	const db = client.db();
	const users = await db.collection("users").find({ riotPuuid: { $exists: true, $ne: null } }).toArray();
	let updated = 0;
	let matchesChecked = 0;
	let errors = 0;

	for (const user of users) {
		try {
			const result = await syncRiotChallengesForUser(db, user._id.toString(), user.riotPuuid, 30);
			matchesChecked += result.matchesChecked;
			if (result.matchesChecked > 0) updated++;
		} catch (error) {
			errors++;
			console.error(`Riot challenge sync failed for ${user._id}:`, error);
		}
	}

	return NextResponse.json({ usersProcessed: users.length, usersUpdated: updated, matchesChecked, errors });
}

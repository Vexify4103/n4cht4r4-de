import { auth } from "@/auth";
import client from "@/lib/db";
import { profileIconUrl } from "@/lib/riot";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	}

	await client.connect();
	const user = await client.db().collection("users").findOne({ _id: new ObjectId(session.user.id) });
	const challenge = user?.riotVerificationChallenge as { profileIconId?: number; expiresAt?: Date } | undefined;

	return NextResponse.json({
		verified: Boolean(user?.riotVerified),
		summonerName: user?.riotSummonerName || null,
		tagLine: user?.riotTagLine || null,
		pendingChallenge: challenge?.profileIconId
			? {
					profileIconId: challenge.profileIconId,
					profileIconUrl: profileIconUrl(challenge.profileIconId),
					expiresAt: new Date(challenge.expiresAt || 0).toISOString(),
				}
			: null,
	});
}

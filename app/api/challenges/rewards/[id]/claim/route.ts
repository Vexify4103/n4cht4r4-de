import { auth } from "@/auth";
import client from "@/lib/db";
import { ChallengeRewardGrant } from "@/lib/challenge-rewards";
import { queueChallengeRoleGrant } from "@/lib/discord-queue";
import { userIdCandidates } from "@/lib/tournament-community";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const { id } = await params;
	await client.connect();
	const db = client.db();
	const grant = await db.collection<ChallengeRewardGrant>("challenge_reward_grants").findOne({ id, userId: session.user.id, type: "discord_role" });
	if (!grant) return NextResponse.json({ error: "Diese Belohnung wurde nicht gefunden." }, { status: 404 });
	if (grant.status === "granted") return NextResponse.json({ granted: true });
	if (grant.status === "queued") return NextResponse.json({ queued: true });
	if (!grant.discordRoleId) return NextResponse.json({ error: "Die Discord-Rolle ist noch nicht konfiguriert." }, { status: 409 });
	const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(session.user.id) }, provider: "discord" });
	const discordId = typeof account?.providerAccountId === "string" ? account.providerAccountId : "";
	if (!discordId) return NextResponse.json({ error: "Verbinde zuerst dein Discord-Konto." }, { status: 409 });
	const reserved = await db
		.collection<ChallengeRewardGrant>("challenge_reward_grants")
		.updateOne(
			{ id: grant.id, userId: session.user.id, status: { $in: ["available", "failed"] } },
			{ $set: { status: "queued", updatedAt: new Date() }, $unset: { lastError: "", discordJobId: "" } }
		);
	if (!reserved.modifiedCount) return NextResponse.json({ queued: true });
	const job = await queueChallengeRoleGrant(db, grant.id, discordId, grant.discordRoleId);
	if (!job) {
		await db
			.collection<ChallengeRewardGrant>("challenge_reward_grants")
			.updateOne({ id: grant.id, status: "queued" }, { $set: { status: "available", updatedAt: new Date() } });
		return NextResponse.json({ error: "Der Discord-Bot ist noch nicht vollständig konfiguriert." }, { status: 503 });
	}
	await db
		.collection<ChallengeRewardGrant>("challenge_reward_grants")
		.updateOne({ id: grant.id }, { $set: { status: "queued", discordJobId: job.id, updatedAt: new Date() }, $unset: { lastError: "" } });
	return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}

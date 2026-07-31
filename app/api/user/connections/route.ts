import { auth } from "@/auth";
import client from "@/lib/db";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function userLookup(id: string, email?: string | null) {
	const candidates: Record<string, unknown>[] = [{ _id: id }];
	if (ObjectId.isValid(id)) candidates.push({ _id: new ObjectId(id) });
	if (email) candidates.push({ email });
	return { $or: candidates };
}

export async function DELETE(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

	const body = await request.json().catch(() => null);
	const provider = body?.provider;
	if (provider !== "twitch" && provider !== "riot") {
		return NextResponse.json({ error: "Diese Verbindung kann hier nicht getrennt werden." }, { status: 400 });
	}

	await client.connect();
	const db = client.db();
	const user = await db.collection("users").findOne(userLookup(session.user.id, session.user.email));
	if (!user?._id) return NextResponse.json({ error: "Dein Profil wurde nicht gefunden." }, { status: 404 });

	if (provider === "twitch") {
		const accountUserIds: unknown[] = [user._id, user._id.toString()];
		if (ObjectId.isValid(user._id.toString())) accountUserIds.push(new ObjectId(user._id.toString()));
		const hasDiscord = await db.collection("accounts").countDocuments({ userId: { $in: accountUserIds }, provider: "discord" });
		if (!hasDiscord) {
			return NextResponse.json({ error: "Verbinde zuerst Discord als Hauptkonto, bevor du Twitch trennst." }, { status: 409 });
		}
		await db.collection("accounts").deleteMany({ userId: { $in: accountUserIds }, provider: "twitch" });
		await db.collection("users").updateOne(
			{ _id: user._id },
			{ $unset: { twitchLogin: "", twitchUserId: "" }, $set: { updatedAt: new Date() } },
		);
	} else {
		await db.collection("users").updateOne(
			{ _id: user._id },
			{
				$unset: {
					riotVerified: "",
					riotPuuid: "",
					riotSummonerName: "",
					riotTagLine: "",
					riotProfileIconId: "",
					riotVerifiedAt: "",
					riotVerificationChallenge: "",
				},
				$set: { updatedAt: new Date() },
			},
		);
		await db.collection("challenge_sync").deleteMany({ userId: user._id.toString() });
	}

	await db.collection("account_connection_audit").insertOne({
		userId: user._id.toString(),
		provider,
		action: "unlinked",
		createdAt: new Date(),
	});

	return NextResponse.json({ unlinked: true, provider });
}

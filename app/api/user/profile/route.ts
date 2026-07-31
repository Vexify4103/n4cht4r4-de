import { auth } from "@/auth";
import { NextResponse } from "next/server";
import client from "@/lib/db";
import { ObjectId } from "mongodb";
import { profileIconUrl } from "@/lib/riot";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await client.connect();
		const db = client.db();

		const userId = session.user.id;
		const userLookup = ObjectId.isValid(userId || "")
			? { $or: [{ _id: new ObjectId(userId) }, { _id: userId as unknown as ObjectId }, { email: session.user.email }] }
			: { $or: [{ _id: userId as unknown as ObjectId }, { email: session.user.email }] };
		const user = await db.collection("users").findOne(userLookup);

		let providers: string[] = [];
		if (user?._id) {
			const accountUserIds: unknown[] = [user._id, user._id.toString()];
			if (ObjectId.isValid(user._id.toString())) accountUserIds.push(new ObjectId(user._id.toString()));
			const accounts = await db
				.collection("accounts")
				.find({ userId: { $in: accountUserIds } })
				.toArray();
			providers = [...new Set(accounts.map((acc: Record<string, unknown>) => acc.provider as string))];
		}

		return NextResponse.json({
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image,
			},
			providers,
			twitchLogin: user?.twitchLogin || null,
			riotVerified: user?.riotVerified || false,
			riotSummonerName: user?.riotSummonerName || null,
			riotTagLine: user?.riotTagLine || null,
			riotVerificationChallenge: user?.riotVerificationChallenge?.profileIconId
				? {
					profileIconId: user.riotVerificationChallenge.profileIconId,
					profileIconUrl: profileIconUrl(user.riotVerificationChallenge.profileIconId),
					expiresAt: new Date(user.riotVerificationChallenge.expiresAt).toISOString(),
				}
				: null,
		});
	} catch (e) {
		console.error("Profile API error:", e);
		return NextResponse.json({
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image,
			},
			providers: [],
			twitchLogin: null,
			riotVerified: false,
			riotSummonerName: null,
			riotTagLine: null,
			riotVerificationChallenge: null,
		});
	}
}

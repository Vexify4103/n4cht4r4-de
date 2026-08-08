import { auth } from "@/auth";
import client from "@/lib/db";
import { getRiotProfileIcon, getRiotRank, profileIconUrl, resolveRiotIdentity, verificationIconIds } from "@/lib/riot";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CHALLENGE_DURATION_MS = 20 * 60 * 1000;

type VerificationChallenge = {
	gameName: string;
	tagLine: string;
	puuid: string;
	platform: string;
	profileIconId: number;
	expiresAt: Date;
};

function pickVerificationIcon() {
	return verificationIconIds[Math.floor(Math.random() * verificationIconIds.length)];
}

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	}

	if (!process.env.RIOT_API_KEY) {
		return NextResponse.json({ error: "Die Riot-Verifizierung ist noch nicht konfiguriert." }, { status: 503 });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body.action !== "string") {
		return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
	}

	await client.connect();
	const users = client.db().collection("users");
	const userId = new ObjectId(session.user.id);

	if (body.action === "start") {
		const gameName = typeof body.gameName === "string" ? body.gameName.trim() : "";
		const tagLine = typeof body.tagLine === "string" ? body.tagLine.trim() : "";
		const region = typeof body.region === "string" ? body.region.trim() : "euw";

		if (!gameName || !tagLine || gameName.length > 32 || tagLine.length > 16) {
			return NextResponse.json({ error: "Bitte gib einen gültigen Riot-Namen und Tag an." }, { status: 400 });
		}

		const identity = await resolveRiotIdentity(gameName, tagLine, region);
		if (!identity) {
			return NextResponse.json({ error: "Riot-Konto nicht gefunden. Prüfe Name, Tag und Region." }, { status: 404 });
		}

		const linkedUser = await users.findOne({ riotPuuid: identity.puuid, _id: { $ne: userId } });
		if (linkedUser) {
			return NextResponse.json({ error: "Dieses Riot-Konto ist bereits mit einem anderen Profil verbunden." }, { status: 409 });
		}

		const challenge: VerificationChallenge = {
			gameName: identity.gameName,
			tagLine: identity.tagLine,
			puuid: identity.puuid,
			platform: identity.platform,
			profileIconId: pickVerificationIcon(),
			expiresAt: new Date(Date.now() + CHALLENGE_DURATION_MS),
		};

		await users.updateOne(
			{ _id: userId },
			{
				$set: {
					riotVerified: false,
					riotVerificationChallenge: challenge,
				},
			}
		);

		return NextResponse.json({
			status: "challenge-issued",
			gameName: challenge.gameName,
			tagLine: challenge.tagLine,
			profileIconId: challenge.profileIconId,
			profileIconUrl: profileIconUrl(challenge.profileIconId),
			expiresAt: challenge.expiresAt.toISOString(),
		});
	}

	if (body.action === "confirm") {
		const user = await users.findOne({ _id: userId });
		const challenge = user?.riotVerificationChallenge as VerificationChallenge | undefined;

		if (!challenge?.puuid || !challenge.expiresAt) {
			return NextResponse.json({ error: "Es gibt keine aktive Riot-Verifizierung. Bitte starte erneut." }, { status: 400 });
		}

		if (new Date(challenge.expiresAt).getTime() < Date.now()) {
			await users.updateOne({ _id: userId }, { $unset: { riotVerificationChallenge: "" } });
			return NextResponse.json({ error: "Die Verifizierung ist abgelaufen. Bitte starte erneut." }, { status: 410 });
		}

		const currentIcon = await getRiotProfileIcon(challenge.puuid, challenge.platform);
		if (currentIcon === null) {
			return NextResponse.json({ error: "Das Riot-Profil konnte gerade nicht geprüft werden. Bitte versuche es gleich noch einmal." }, { status: 502 });
		}

		if (currentIcon !== challenge.profileIconId) {
			return NextResponse.json({
				verified: false,
				error: "Das ausgewählte Profilbild wurde noch nicht erkannt.",
				profileIconId: challenge.profileIconId,
				profileIconUrl: profileIconUrl(challenge.profileIconId),
			});
		}
		const rank = await getRiotRank(challenge.puuid, challenge.platform);

		await users.updateOne(
			{ _id: userId },
			{
				$set: {
					riotVerified: true,
					riotPuuid: challenge.puuid,
					riotSummonerName: challenge.gameName,
					riotTagLine: challenge.tagLine,
					riotPlatform: challenge.platform,
					riotProfileIconId: currentIcon,
					riotRank: rank?.label || "Unranked",
					riotRankUpdatedAt: new Date(),
					riotVerifiedAt: new Date(),
				},
				$unset: { riotVerificationChallenge: "" },
			}
		);

		return NextResponse.json({ verified: true, gameName: challenge.gameName, tagLine: challenge.tagLine });
	}

	return NextResponse.json({ error: "Unbekannte Verifizierungsaktion." }, { status: 400 });
}

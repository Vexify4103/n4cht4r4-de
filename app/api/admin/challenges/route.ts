import { hasTournamentPermission } from "@/lib/tournament-admin";
import client from "@/lib/db";
import { ChallengeDef, ChallengeType, ensureChallengeDefinitions } from "@/lib/challenges";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const TYPES: ChallengeType[] = ["matches", "wins", "kills", "watchtime", "community", "meta"];
const REQUIREMENTS: NonNullable<ChallengeDef["requirement"]>[] = ["discord", "twitch", "riot", "community"];

function challengeInput(body: Record<string, unknown>, current?: ChallengeDef) {
	const startsAt = new Date(String(body.startsAt || current?.startsAt || ""));
	const endsAt = new Date(String(body.endsAt || current?.endsAt || ""));
	const type = String(body.type || current?.type || "") as ChallengeType;
	const title = String(body.title || current?.title || "")
		.trim()
		.slice(0, 100);
	const description = String(body.description || current?.description || "")
		.trim()
		.slice(0, 500);
	const titleEn =
		String(body.titleEn ?? current?.titleEn ?? "")
			.trim()
			.slice(0, 100) || undefined;
	const descriptionEn =
		String(body.descriptionEn ?? current?.descriptionEn ?? "")
			.trim()
			.slice(0, 500) || undefined;
	const target = Number(body.target ?? current?.target);
	const queueId = body.queueId === undefined ? current?.queueId : body.queueId === "" || body.queueId === null ? undefined : Number(body.queueId);
	const sortOrder = Number(body.sortOrder ?? current?.sortOrder ?? 999);
	const requirement = String(body.requirement || current?.requirement || "discord") as NonNullable<ChallengeDef["requirement"]>;
	if (
		!title ||
		!description ||
		!TYPES.includes(type) ||
		!Number.isFinite(target) ||
		target < 1 ||
		Number.isNaN(startsAt.getTime()) ||
		Number.isNaN(endsAt.getTime()) ||
		startsAt >= endsAt ||
		(queueId !== undefined && (!Number.isInteger(queueId) || queueId < 0)) ||
		!Number.isFinite(sortOrder) ||
		!REQUIREMENTS.includes(requirement)
	) {
		throw new Error("Titel, Beschreibung, Typ, Ziel und ein gültiger Zeitraum sind erforderlich.");
	}
	const badgeName = String(body.badgeName ?? current?.badge?.name ?? "")
		.trim()
		.slice(0, 80);
	const badgeId = String(body.badgeId ?? current?.badge?.id ?? "")
		.trim()
		.slice(0, 80);
	const prerequisiteIds =
		typeof body.prerequisiteIds === "string"
			? body.prerequisiteIds
					.split(",")
					.map((id) => id.trim())
					.filter(Boolean)
					.slice(0, 20)
			: current?.prerequisiteIds;
	return {
		title,
		titleEn,
		description,
		descriptionEn,
		type,
		target,
		seasonId: String(body.seasonId || current?.seasonId || "custom")
			.trim()
			.slice(0, 80),
		icon: String(body.icon || current?.icon || "🌸")
			.trim()
			.slice(0, 8),
		gameMode:
			String(body.gameMode ?? current?.gameMode ?? "")
				.trim()
				.slice(0, 32) || undefined,
		queueId,
		requirement,
		startsAt,
		endsAt,
		enabled: body.enabled === undefined ? current?.enabled !== false : body.enabled === true,
		sortOrder,
		reward:
			String(body.reward ?? current?.reward ?? "")
				.trim()
				.slice(0, 240) || undefined,
		rewardEn:
			String(body.rewardEn ?? current?.rewardEn ?? "")
				.trim()
				.slice(0, 240) || undefined,
		discordRoleId:
			String(body.discordRoleId ?? current?.discordRoleId ?? "")
				.trim()
				.slice(0, 32) || undefined,
		discordRoleName:
			String(body.discordRoleName ?? current?.discordRoleName ?? "")
				.trim()
				.slice(0, 80) || undefined,
		prerequisiteIds,
		badge:
			badgeName && badgeId
				? {
						id: badgeId,
						name: badgeName,
						nameEn:
							String(body.badgeNameEn ?? current?.badge?.nameEn ?? "")
								.trim()
								.slice(0, 80) || undefined,
						description: String(body.badgeDescription ?? current?.badge?.description ?? description)
							.trim()
							.slice(0, 240),
						descriptionEn:
							String(body.badgeDescriptionEn ?? current?.badge?.descriptionEn ?? "")
								.trim()
								.slice(0, 240) || undefined,
						icon: String(body.badgeIcon ?? current?.badge?.icon ?? body.icon ?? current?.icon ?? "🌸")
							.trim()
							.slice(0, 8),
						rarity: ["common", "rare", "epic"].includes(String(body.badgeRarity ?? current?.badge?.rarity))
							? (String(body.badgeRarity ?? current?.badge?.rarity) as "common" | "rare" | "epic")
							: "common",
					}
				: undefined,
	};
}

export async function GET() {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung für die Challenge-Verwaltung." }, { status: 403 });
	await client.connect();
	const db = client.db();
	await ensureChallengeDefinitions(db);
	const [challenges, riotQueue, discordQueue] = await Promise.all([
		db.collection<ChallengeDef>("challenge_definitions").find({}).project({ _id: 0 }).sort({ enabled: -1, sortOrder: 1 }).toArray(),
		db.collection("riot_sync_queue").countDocuments({ status: { $in: ["queued", "processing"] } }),
		db.collection("discord_queue").countDocuments({ status: { $in: ["queued", "processing"] } }),
	]);
	return NextResponse.json({ challenges, queues: { riot: riotQueue, discord: discordQueue }, role: staff.role });
}

export async function POST(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung für die Challenge-Verwaltung." }, { status: 403 });
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) return NextResponse.json({ error: "Challenge-Daten fehlen." }, { status: 400 });
	try {
		const now = new Date();
		const challenge = { id: `challenge_${crypto.randomUUID()}`, ...challengeInput(body), systemVersion: 2, createdAt: now, updatedAt: now };
		await client.connect();
		await client.db().collection("challenge_definitions").insertOne(challenge);
		return NextResponse.json({ challenge }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Challenge konnte nicht erstellt werden." }, { status: 400 });
	}
}

export async function PATCH(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung für die Challenge-Verwaltung." }, { status: 403 });
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Challenge-ID fehlt." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const current = await db.collection<ChallengeDef>("challenge_definitions").findOne({ id: body.id });
	if (!current) return NextResponse.json({ error: "Challenge nicht gefunden." }, { status: 404 });
	try {
		const challenge = await db
			.collection<ChallengeDef>("challenge_definitions")
			.findOneAndUpdate({ id: current.id }, { $set: { ...challengeInput(body, current), updatedAt: new Date() } }, { returnDocument: "after", projection: { _id: 0 } });
		return NextResponse.json({ challenge });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Challenge konnte nicht gespeichert werden." }, { status: 400 });
	}
}

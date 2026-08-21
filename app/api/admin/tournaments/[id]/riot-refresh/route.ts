import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { enqueueRiotProfileRefresh, ensureRiotQueueIndexes, RiotProfileRefreshTarget } from "@/lib/riot-sync-queue";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RefreshTarget = RiotProfileRefreshTarget & { key: string };

function normalizedRiotId(value: unknown) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function refreshState(db: ReturnType<typeof client.db>) {
	const latest = await db.collection("riot_sync_queue").findOne({ type: "profile", batchId: { $exists: true } }, { sort: { createdAt: -1 } });
	if (!latest?.batchId) return { active: false, batchId: null, total: 0, queued: 0, processing: 0, completed: 0, failed: 0 };
	const counts = await db
		.collection("riot_sync_queue")
		.aggregate<{ _id: string; count: number }>([{ $match: { type: "profile", batchId: latest.batchId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
		.toArray();
	const byStatus = new Map(counts.map((entry) => [entry._id, entry.count]));
	const queued = byStatus.get("queued") || 0;
	const processing = byStatus.get("processing") || 0;
	const completed = byStatus.get("completed") || 0;
	const failed = byStatus.get("failed") || 0;
	return {
		active: queued + processing > 0,
		batchId: latest.batchId,
		total: queued + processing + completed + failed,
		queued,
		processing,
		completed,
		failed,
		createdAt: latest.createdAt,
	};
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	const { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	return NextResponse.json(await refreshState(db));
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Aktualisieren von Riot-Profilen." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	await ensureRiotQueueIndexes(db);
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const active = await db.collection("riot_sync_queue").countDocuments({ type: "profile", status: { $in: ["queued", "processing"] } });
	if (active) return NextResponse.json({ error: "Eine globale Riot-Aktualisierung läuft bereits." }, { status: 409 });

	const [users, applications] = await Promise.all([
		db
			.collection("users")
			.find({ riotPuuid: { $exists: true, $nin: [null, ""] } })
			.project({ riotPuuid: 1, riotPlatform: 1, riotSummonerName: 1, riotTagLine: 1 })
			.toArray(),
		db
			.collection("tournament_applications")
			.find({ $or: [{ riotPuuid: { $exists: true, $nin: [null, ""] } }, { riotId: { $exists: true, $nin: [null, ""] } }] })
			.project({ id: 1, userId: 1, riotPuuid: 1, riotPlatform: 1, riotId: 1 })
			.toArray(),
	]);
	const usersById = new Map(users.map((user) => [user._id.toString(), user]));
	const targets = new Map<string, RefreshTarget>();
	const mergeTarget = (input: RefreshTarget) => {
		const current = targets.get(input.key);
		if (!current) targets.set(input.key, input);
		else {
			current.userIds.push(...input.userIds);
			current.applicationIds.push(...input.applicationIds);
		}
	};

	for (const user of users) {
		const puuid = String(user.riotPuuid || "");
		if (!puuid) continue;
		mergeTarget({
			key: `puuid:${puuid}`,
			puuid,
			platform: String(user.riotPlatform || "euw1"),
			riotId: user.riotSummonerName && user.riotTagLine ? `${user.riotSummonerName}#${user.riotTagLine}` : undefined,
			userIds: [user._id.toString()],
			applicationIds: [],
		});
	}
	for (const application of applications) {
		const linkedUser = usersById.get(String(application.userId || ""));
		const puuid = String(application.riotPuuid || linkedUser?.riotPuuid || "");
		const riotId = String(application.riotId || "").trim();
		const key = puuid ? `puuid:${puuid}` : normalizedRiotId(riotId) ? `riot-id:${normalizedRiotId(riotId)}` : "";
		if (!key) continue;
		mergeTarget({
			key,
			puuid: puuid || undefined,
			platform: String(application.riotPlatform || linkedUser?.riotPlatform || "euw1"),
			riotId: riotId || undefined,
			userIds: typeof application.userId === "string" ? [application.userId] : [],
			applicationIds: typeof application.id === "string" ? [application.id] : [],
		});
	}

	const batchId = `riot_batch_${crypto.randomUUID()}`;
	const now = Date.now();
	const queued = [];
	for (const [index, target] of [...targets.values()].entries()) {
		queued.push(await enqueueRiotProfileRefresh(db, target, batchId, new Date(now + index * 5_000)));
	}
	await recordTournamentAudit(db, staff, id, "riot.profile_refresh.queued", {
		batchId,
		profiles: targets.size,
		jobsQueued: queued.filter((entry) => entry.created).length,
	});
	return NextResponse.json(
		{
			batchId,
			queued: queued.filter((entry) => entry.created).length,
			profiles: targets.size,
			estimatedSeconds: targets.size * 5,
		},
		{ status: 202 }
	);
}

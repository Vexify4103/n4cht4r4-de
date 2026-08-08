import client from "@/lib/db";
import { announcedTournaments, normalizeTournament, TournamentRecord } from "@/lib/tournaments";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	try {
		await client.connect();
		const db = client.db();
		const records = await db
			.collection("tournaments")
			.find({ published: { $ne: false } })
			.sort({ date: 1 })
			.toArray();
		const resolvedRecords = await Promise.all(records.map(async (record) => (await resolveTournament(db, String(record.id))) || record));
		const tournaments = resolvedRecords
			.map((record) => {
				const normalized = normalizeTournament(record);
				return normalized ? { ...normalized, id: publicTournamentId(record) } : null;
			})
			.filter((record): record is TournamentRecord => Boolean(record));
		return NextResponse.json({ tournaments: tournaments.length > 0 ? tournaments : announcedTournaments });
	} catch {
		return NextResponse.json({ tournaments: announcedTournaments });
	}
}

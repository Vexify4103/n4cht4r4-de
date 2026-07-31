import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await client.connect();
	const db = client.db();
	const [general, tournaments] = await Promise.all([
		db.collection("applications").find({ userId: session.user.id }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray(),
		db.collection("tournament_applications").find({ userId: session.user.id }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray(),
	]);
	const tournamentIds = [...new Set(tournaments.map((entry) => entry.tournamentId).filter(Boolean))];
	const tournamentRecords = tournamentIds.length
		? await db.collection("tournaments").find({ id: { $in: tournamentIds } }).project({ _id: 0, id: 1, title: 1, slug: 1 }).toArray()
		: [];
	const tournamentNames = new Map(tournamentRecords.map((entry) => [entry.id, { title: entry.title, slug: entry.slug || entry.id }]));

	const applications: Record<string, unknown>[] = [
			...general.map((entry) => ({ ...entry, category: "general" })),
			...tournaments.map((entry) => ({
				...entry,
				category: "tournament",
				title: tournamentNames.get(entry.tournamentId)?.title || "Turnier",
				tournamentSlug: tournamentNames.get(entry.tournamentId)?.slug || entry.tournamentId,
			})),
		];
	applications.sort((a, b) => new Date(b.createdAt as string | Date).getTime() - new Date(a.createdAt as string | Date).getTime());

	return NextResponse.json({ applications });
}

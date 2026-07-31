import { Db } from "mongodb";

function slugify(value: string) {
	return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "turnier";
}

export async function resolveTournament(db: Db, identifier: string) {
	const tournament = await db.collection("tournaments").findOne({ $or: [{ id: identifier }, { slug: identifier }] });
	if (!tournament) return null;
	if (typeof tournament.slug === "string" && tournament.slug) return tournament;

	const base = slugify(String(tournament.title || "turnier"));
	let slug = base;
	let suffix = 2;
	while (await db.collection("tournaments").findOne({ slug, id: { $ne: tournament.id } }, { projection: { _id: 1 } })) slug = `${base}-${suffix++}`;
	await db.collection("tournaments").updateOne({ id: tournament.id }, { $set: { slug } });
	return { ...tournament, slug };
}

export function publicTournamentId(tournament: Record<string, unknown>) {
	return typeof tournament.slug === "string" && tournament.slug ? tournament.slug : String(tournament.id);
}

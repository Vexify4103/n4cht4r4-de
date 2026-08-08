import fs from "node:fs";
import { MongoClient } from "mongodb";

function loadLocalEnvironment() {
	for (const filename of [".env.local", ".env"]) {
		if (!fs.existsSync(filename)) continue;
		for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
			const match = line.match(/^([^#=]+)=(.*)$/);
			if (!match || process.env[match[1].trim()]) continue;
			let value = match[2].trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
			process.env[match[1].trim()] = value;
		}
	}
}

const tournamentSeeds = [
	{
		id: "tournament_bloom_in_chaos_2026",
		slug: "bloom-in-chaos",
		title: "ARAM Mayhem – Bloom in Chaos",
		game: "League of Legends",
		gameMode: "ARAM MAYHEM",
		format: "5v5 · Double Elimination · Loser Bracket",
		description:
			"Ein ARAM-MAYHEM-Turnier ohne LP-Druck und Preise: Es geht um Ruhm, Ehre, dumme Plays, schöne Plays und jede Menge gemeinsames Chaos. Alle melden sich einzeln an; danach könnt ihr unverbindliche Wunschgruppen bilden.",
		tagline: "Bloom in Chaos. Rise in Glory.",
		status: "announcement",
		date: "2026-10-10T12:00:00.000Z",
		maxTeams: null,
		currentTeams: 0,
		teamSize: 5,
		bracketType: "double_elimination",
		seriesBestOf: null,
		championRule: "none",
		applicationModes: ["solo"],
		wishGroupMode: "team",
		requiredConnections: ["discord", "twitch", "riot"],
		collectRoles: false,
		registrationOpen: false,
		registrationNote: "Der Start der Anmeldung und die maximale Teamanzahl werden noch bekannt gegeben.",
		rules: [],
		published: true,
		createdAt: new Date("2026-08-08T00:00:00.000Z"),
		updatedAt: new Date(),
		seedVersion: 3,
	},
];

loadLocalEnvironment();
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI fehlt in .env.local oder .env.");

const client = new MongoClient(process.env.MONGODB_URI, {
	directConnection: process.env.MONGODB_DIRECT_CONNECTION === "true",
	serverSelectionTimeoutMS: 10_000,
});
try {
	await client.connect();
	const tournaments = client.db().collection("tournaments");
	for (const seed of tournamentSeeds) {
		const result = await tournaments.updateOne({ id: seed.id }, { $setOnInsert: seed }, { upsert: true });
		if (result.upsertedCount) {
			console.log(`Angelegt: ${seed.title}`);
			continue;
		}
		const migration = await tournaments.updateOne(
			{ id: seed.id, seedVersion: { $ne: 3 } },
			{ $set: { applicationModes: ["solo"], wishGroupMode: "team", collectRoles: false, description: seed.description, seedVersion: 3, updatedAt: new Date() } }
		);
		console.log(migration.modifiedCount ? `Aktualisiert: ${seed.title}` : `Bereits vorhanden: ${seed.title}`);
	}
} catch (error) {
	console.error(`Turniere konnten nicht angelegt werden: ${error instanceof Error ? error.message : "MongoDB ist nicht erreichbar."}`);
	process.exitCode = 1;
} finally {
	await client.close();
}

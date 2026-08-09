import client from "@/lib/db";
import { cleanCommunityProject, defaultCommunityProjects, ensureCommunityIndexes } from "@/lib/community";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	try {
		await client.connect();
		const db = client.db();
		await ensureCommunityIndexes(db);
		const [records, storedCount] = await Promise.all([
			db
				.collection("community_projects")
				.find({ published: { $ne: false } })
				.project({ _id: 0 })
				.sort({ order: 1, title: 1 })
				.toArray(),
			db.collection("community_projects").countDocuments({}),
		]);
		const projects = records.map((record) => cleanCommunityProject(record)).filter((project) => project !== null);
		return NextResponse.json({ projects: storedCount ? projects : defaultCommunityProjects });
	} catch {
		return NextResponse.json({ projects: defaultCommunityProjects });
	}
}

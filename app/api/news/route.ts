import client from "@/lib/db";
import { ensureNews } from "@/lib/news";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		await client.connect();
		const db = client.db();
		await ensureNews(db);
		const news = await db.collection("news").find({ published: true }).project({ _id: 0 }).sort({ pinned: -1, createdAt: -1 }).limit(6).toArray();
		return NextResponse.json({ news });
	} catch {
		return NextResponse.json({ news: [] }, { status: 503 });
	}
}

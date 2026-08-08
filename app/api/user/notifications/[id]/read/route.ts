import { auth } from "@/auth";
import client from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const { id } = await params;
	await client.connect();
	const result = await client
		.db()
		.collection("tournament_notifications")
		.updateOne({ id, userId: session.user.id }, { $set: { readAt: new Date() } });
	if (!result.matchedCount) return NextResponse.json({ error: "Benachrichtigung nicht gefunden." }, { status: 404 });
	return NextResponse.json({ read: true });
}

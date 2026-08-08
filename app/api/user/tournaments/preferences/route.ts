import { auth } from "@/auth";
import client from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (typeof body?.applicationId !== "string" || typeof body?.discordDmOptIn !== "boolean")
		return NextResponse.json({ error: "Ungültige Benachrichtigungseinstellung." }, { status: 400 });
	await client.connect();
	const result = await client
		.db()
		.collection("tournament_applications")
		.updateOne({ id: body.applicationId, userId: session.user.id }, { $set: { discordDmOptIn: body.discordDmOptIn, updatedAt: new Date() } });
	if (!result.matchedCount) return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
	return NextResponse.json({ updated: true });
}

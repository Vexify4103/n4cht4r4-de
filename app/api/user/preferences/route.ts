import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import client from "@/lib/db";

export const runtime = "nodejs";

function userFilter(id: string) {
	return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as unknown as ObjectId };
}

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	await client.connect();
	const user = await client
		.db()
		.collection("users")
		.findOne(userFilter(session.user.id), { projection: { locale: 1 } });
	return NextResponse.json({ locale: user?.locale === "en" ? "en" : "de" });
}

export async function PATCH(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
	if (body?.locale !== "de" && body?.locale !== "en") return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
	await client.connect();
	await client
		.db()
		.collection("users")
		.updateOne(userFilter(session.user.id), { $set: { locale: body.locale, updatedAt: new Date() } });
	return NextResponse.json({ ok: true });
}

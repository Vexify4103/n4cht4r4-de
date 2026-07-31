import { auth } from "@/auth";
import { ApplicationType, getApplicationTypes, isApplicationType } from "@/lib/applications";
import client from "@/lib/db";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function text(value: unknown, maxLength: number) {
	return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
	await client.connect();
	return NextResponse.json({ applications: await getApplicationTypes(client.db()) });
}

export async function POST(request: NextRequest) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	if (!body || !isApplicationType(body.type)) {
		return NextResponse.json({ error: "Unbekannte Bewerbungsart." }, { status: 400 });
	}

	await client.connect();
	const db = client.db();
	const applicationType = body.type as ApplicationType;
	const definition = (await getApplicationTypes(db))[applicationType];
	if (!definition.open) {
		return NextResponse.json({ error: "Diese Bewerbung ist aktuell nicht geöffnet." }, { status: 403 });
	}

	const discord = text(body.discord, 64);
	const reason = text(body.reason, 2_000);
	const experience = text(body.experience, 2_000);
	if (!discord || reason.length < 20) {
		return NextResponse.json({ error: "Bitte fülle Discord-Name und eine aussagekräftige Begründung aus." }, { status: 400 });
	}
	if (body.accepted !== true) {
		return NextResponse.json({ error: "Bitte akzeptiere Datenschutz und Teilnahmebedingungen." }, { status: 400 });
	}

	const userId = session.user.id;
	const userFilter = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId as unknown as ObjectId };
	const user = await db.collection("users").findOne(userFilter);
	const accountIds: unknown[] = [user?._id, user?._id?.toString()].filter(Boolean);
	if (user?._id && ObjectId.isValid(user._id.toString())) accountIds.push(new ObjectId(user._id.toString()));
	const accounts = await db.collection("accounts").find({ userId: { $in: accountIds } }).toArray();
	const providers = new Set(accounts.map((account) => account.provider));

	if (definition.requires.includes("discord") && !providers.has("discord")) {
		return NextResponse.json({ error: "Für diese Bewerbung musst du zuerst Discord verbinden." }, { status: 403 });
	}
	if (definition.requires.includes("riot") && !user?.riotVerified) {
		return NextResponse.json({ error: "Für diese Bewerbung musst du zuerst dein Riot-Konto verifizieren." }, { status: 403 });
	}

	const applications = db.collection("applications");
	const existing = await applications.findOne({ userId: session.user.id, type: applicationType, status: "pending" });
	if (existing) {
		return NextResponse.json({ error: "Du hast für diesen Bereich bereits eine offene Bewerbung." }, { status: 409 });
	}

	await applications.insertOne({
		userId: session.user.id,
		type: applicationType,
		discord,
		reason,
		experience,
		riotName: text(body.riotName, 32),
		riotTag: text(body.riotTag, 16),
		role: text(body.role, 32),
		age: text(body.age, 3),
		availability: text(body.availability, 500),
		minecraftName: text(body.minecraftName, 32),
		status: "pending",
		consent: {
			version: "2026-06",
			acceptedAt: new Date(),
		},
		createdAt: new Date(),
	});

	return NextResponse.json({ ok: true }, { status: 201 });
}

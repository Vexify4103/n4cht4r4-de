import client from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	try {
		await client.connect();
		const records = await client
			.db()
			.collection("donations")
			.aggregate([
				{ $match: { public: { $ne: false }, displayName: { $type: "string" }, amountCents: { $type: "number" } } },
				{ $group: { _id: { name: "$displayName", currency: { $ifNull: ["$currency", "EUR"] } }, amountCents: { $sum: "$amountCents" } } },
				{ $sort: { amountCents: -1 } },
				{ $limit: 5 },
				{ $project: { _id: 0, name: "$_id.name", currency: "$_id.currency", amountCents: 1 } },
			])
			.limit(5)
			.toArray();

		const donations = records
			.filter((record) => typeof record.name === "string" && typeof record.amountCents === "number")
			.map((record) => ({ name: record.name as string, amountCents: record.amountCents as number, currency: typeof record.currency === "string" ? record.currency : "EUR" }));

		return NextResponse.json({ donations });
	} catch {
		return NextResponse.json({ donations: [] });
	}
}

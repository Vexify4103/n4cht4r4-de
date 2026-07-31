import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	return NextResponse.json({ challenges: [] });
}

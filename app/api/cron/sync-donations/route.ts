import { NextResponse } from "next/server";
import { syncStreamElementsDonations } from "@/lib/streamelements";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

async function syncDonations(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await syncStreamElementsDonations());
  } catch (error) {
    console.error("[Donations] StreamElements sync failed:", error);
    return NextResponse.json({ error: "Donation sync failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return syncDonations(req);
}

export async function POST(req: Request) {
  return syncDonations(req);
}

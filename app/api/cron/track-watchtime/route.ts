import { NextResponse } from "next/server";
import { diagnoseWatchTime, trackWatchTime } from "@/lib/watchtime";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

async function runWatchTimeCron(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (new URL(req.url).searchParams.get("diagnostic") === "1") {
      return NextResponse.json(await diagnoseWatchTime());
    }
    const result = await trackWatchTime();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[WatchTime] Cron failed:", error);
    return NextResponse.json({ error: "Watchtime update failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return runWatchTimeCron(req);
}

export async function POST(req: Request) {
  return runWatchTimeCron(req);
}

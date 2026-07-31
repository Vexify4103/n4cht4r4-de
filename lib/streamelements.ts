import client from "@/lib/db";

const STREAM_ELEMENTS_JWT = process.env.STREAMELEMENTS_JWT;
const STREAM_ELEMENTS_CHANNEL_ID = process.env.STREAMELEMENTS_CHANNEL_ID;
const API_BASE = "https://api.streamelements.com/kappa/v2";

type UnknownRecord = Record<string, unknown>;

export type DonationSyncResult = {
  imported: number;
  skipped: number;
  channelId: string;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function extractItems(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
  const record = asRecord(payload);
  if (!record) return [];

  for (const key of ["data", "docs", "items", "tips"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
  }
  return [];
}

function normalizeTip(tip: UnknownRecord) {
  const data = asRecord(tip.data) || {};
  const donation = asRecord(tip.donation) || {};
  const donor = asRecord(donation.user) || {};
  const displayName = firstString(
    tip.username,
    tip.displayName,
    tip.name,
    data.username,
    data.displayName,
    data.name,
    donor.username
  );
  const amountCents = firstNumber(tip.amountCents, tip.amount_cents, data.amountCents, data.amount_cents, donation.amountCents, donation.amount_cents);
  const amount = amountCents ?? firstNumber(tip.amount, data.amount, donation.amount);
  const rawCurrency = (firstString(tip.currency, data.currency, donation.currency) || "EUR").toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "EUR";
  const sourceId = firstString(tip._id, tip.id, tip.tipId, data._id, data.id);

  if (tip.deleted === true || !displayName || amount === null || amount <= 0 || !sourceId) return null;

  return {
    sourceId,
    displayName,
    // StreamElements tip amounts are decimal currency amounts unless explicitly marked as cents.
    amountCents: amountCents ?? Math.round(amount * 100),
    currency,
    donatedAt: firstString(tip.createdAt, tip.created_at, data.createdAt, data.created_at),
  };
}

async function streamElementsFetch(path: string) {
  if (!STREAM_ELEMENTS_JWT) throw new Error("StreamElements JWT is not configured");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${STREAM_ELEMENTS_JWT}`,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`StreamElements request failed (${res.status})`);
  return res.json() as Promise<unknown>;
}

async function getChannelId() {
  if (STREAM_ELEMENTS_CHANNEL_ID) return STREAM_ELEMENTS_CHANNEL_ID;
  const payload = asRecord(await streamElementsFetch("/channels/me"));
  const channelId = firstString(payload?._id, payload?.id);
  if (!channelId) throw new Error("StreamElements channel ID could not be resolved");
  return channelId;
}

export async function syncStreamElementsDonations(): Promise<DonationSyncResult> {
  const channelId = await getChannelId();
  const payload = await streamElementsFetch(`/tips/${encodeURIComponent(channelId)}?limit=100&offset=0`);
  const tips = extractItems(payload);

  await client.connect();
  const donations = client.db().collection("donations");
  let imported = 0;
  let skipped = 0;

  for (const tip of tips) {
    const normalized = normalizeTip(tip);
    if (!normalized) {
      skipped++;
      continue;
    }

    await donations.updateOne(
      { source: "streamelements", sourceId: normalized.sourceId },
      {
        $set: {
          ...normalized,
          source: "streamelements",
          public: true,
          syncedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    imported++;
  }

  return { imported, skipped, channelId };
}

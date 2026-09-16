import { NextRequest, NextResponse } from "next/server";
import { SEARCH_UNAVAILABLE_COPY } from "../../../lib/geocode";
import { maptilerForwardUrl, parseMaptilerFeatures } from "../../../lib/maptilerGeocode";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  const key = process.env.MAPTILER_API_KEY?.trim();
  if (!key) {
    return json({ available: false, suggestions: [], error: SEARCH_UNAVAILABLE_COPY }, 503);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return json({ available: true, suggestions: [] });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const proximity = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;

  try {
    const res = await fetch(maptilerForwardUrl(q.slice(0, 200), key, proximity), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Hashpop/1.0 (https://hashpop.io)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return json({ available: true, suggestions: [] }, 502);
    }
    const data: unknown = await res.json();
    return json({ available: true, suggestions: parseMaptilerFeatures(data) });
  } catch {
    return json({ available: true, suggestions: [] }, 502);
  }
}

import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export const alt = "Hashpop marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Hashvinci OG/Twitter fallback v2. Same file for both routes. */
const CARD_PATH = path.join(process.cwd(), "assets/hashpop-og-v2.png");

export default async function Image() {
  const bytes = await readFile(CARD_PATH);
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

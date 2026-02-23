/**
 * Ensure listing image URL is absolute so it loads from the API server (same host on LAN).
 */
import { getApiUrl } from "./apiUrl";

export function resolveListingImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const base = getApiUrl().replace(/\/$/, "");
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/uploads/${trimmed}`;
}

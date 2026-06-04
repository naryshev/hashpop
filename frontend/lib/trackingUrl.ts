/** Common shipping carriers offered in the tracking dropdown. */
export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Canada Post", "Royal Mail"];

/**
 * Build a public tracking URL for a carrier + tracking number. Falls back to a
 * Google search when the carrier is unknown, so the buyer always gets a link.
 */
export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const num = (trackingNumber ?? "").trim();
  if (!num) return null;
  const key = (carrier ?? "").trim().toLowerCase();
  const encoded = encodeURIComponent(num);

  if (key.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  if (key.includes("ups")) return `https://www.ups.com/track?tracknum=${encoded}`;
  if (key.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  if (key.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${encoded}`;
  if (key.includes("canada post"))
    return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encoded}`;
  if (key.includes("royal mail"))
    return `https://www.royalmail.com/track-your-item#/tracking-results/${encoded}`;

  // Unknown carrier — search for the tracking number.
  const q = carrier ? `${carrier} ${num}` : num;
  return `https://www.google.com/search?q=${encodeURIComponent(`track ${q}`)}`;
}

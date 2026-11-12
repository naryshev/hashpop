import { SEO_COPY } from "../../lib/seo/copy";

/**
 * /marketplace H1. The page shows only the marketplace (filters + grid), so
 * the heading is visually hidden but stays in the server HTML for SEO and
 * screen readers. It lives in the /marketplace server page, not in
 * MarketplacePageClient, so / (which already has HomeMarketplaceHeading)
 * does not get a second H1.
 */
export function MarketplaceHeading() {
  return (
    <h1 data-testid="marketplace-h1" className="sr-only">
      {SEO_COPY.marketplaceH1}
    </h1>
  );
}

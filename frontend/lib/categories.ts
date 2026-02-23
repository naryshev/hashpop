/**
 * Marketplace categories derived from Craigslist for-sale section.
 * Family-safe, legal to list in any jurisdiction; no adult or restricted categories.
 */

export const LISTING_CATEGORIES: string[] = [
  "Antiques",
  "Appliances",
  "Arts & Crafts",
  "ATV / UTV / Snow",
  "Auto Parts",
  "Aviation",
  "Baby & Kid",
  "Barter",
  "Beauty & Health",
  "Bikes",
  "Bike Parts",
  "Boats",
  "Boat Parts",
  "Books",
  "Business",
  "CDs / DVD / VHS",
  "Cell Phones",
  "Clothes & Accessories",
  "Collectibles",
  "Computers",
  "Computer Parts",
  "Electronics",
  "Farm & Garden",
  "Furniture",
  "Garage Sale",
  "General",
  "Heavy Equipment",
  "Household",
  "Jewelry",
  "Materials",
  "Motorcycles",
  "Motorcycle Parts",
  "Music Instruments",
  "Photo & Video",
  "RVs & Camp",
  "Sporting",
  "Tickets",
  "Tools",
  "Toys & Games",
  "Trailers",
  "Video Gaming",
  "Wheels & Tires",
  "Free Stuff",
  "Other",
];

/**
 * Filter categories by search query (case-insensitive, substring match).
 */
export function searchCategories(query: string, limit = 50): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return LISTING_CATEGORIES.slice(0, limit);
  return LISTING_CATEGORIES.filter((cat) => cat.toLowerCase().includes(q)).slice(0, limit);
}

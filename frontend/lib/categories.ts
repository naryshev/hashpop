import Fuse from "fuse.js";

/** Canonical listing categories used across header filters and create form. */
export const LISTING_CATEGORIES: string[] = [
  "Watches",
  "Cars",
  "Computers",
  "Shoes",
  "Clothes",
  "Accessories",
  "Food Products",
  "Precious Metals",
  "Digital Goods",
  "Electronic Items",
  "Software",
  "Access Codes",
  "Paper Media",
];

const CATEGORY_ALIASES: Record<string, string> = {
  watch: "Watches",
  watches: "Watches",
  car: "Cars",
  cars: "Cars",
  computer: "Computers",
  computers: "Computers",
  shoe: "Shoes",
  shoes: "Shoes",
  clothes: "Clothes",
  clothing: "Clothes",
  accessory: "Accessories",
  accessories: "Accessories",
  "food product": "Food Products",
  "food products": "Food Products",
  "precious metal": "Precious Metals",
  "precious metals": "Precious Metals",
  "digital good": "Digital Goods",
  "digital goods": "Digital Goods",
  "electronic item": "Electronic Items",
  "electronic items": "Electronic Items",
  "electornic items": "Electronic Items",
  software: "Software",
  "access code": "Access Codes",
  "access codes": "Access Codes",
  "paper media": "Paper Media",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function canonicalizeCategory(input: string | null | undefined): string {
  if (!input) return "";
  const key = normalizeKey(input);
  return CATEGORY_ALIASES[key] ?? input.trim();
}

/** Fuzzy filter categories by query (case-insensitive). */
export function searchCategories(query: string, limit = 50): string[] {
  const q = query.trim();
  if (!q) return LISTING_CATEGORIES.slice(0, limit);
  const fuse = new Fuse(LISTING_CATEGORIES, { threshold: 0.35, ignoreLocation: true });
  const result = fuse.search(q).map((r) => r.item);
  const direct = LISTING_CATEGORIES.filter((cat) => cat.toLowerCase().includes(q.toLowerCase()));
  return Array.from(new Set([...direct, ...result])).slice(0, limit);
}

import Link from "next/link";
import type { Metadata } from "next";
import { getApiUrl } from "../../lib/apiUrl";
import { CATEGORY_GROUPS, canonicalizeCategory } from "../../lib/categories";

export const metadata: Metadata = {
  title: "Browse Categories · Hashpop",
  description:
    "Browse the Hashpop marketplace by category — electronics, vehicles, fashion, collectibles and more.",
  openGraph: {
    title: "Browse Categories · Hashpop",
    description: "Browse the Hashpop marketplace by category.",
    type: "website",
  },
};

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

async function loadCategoryCounts(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      listings?: { category?: string | null; status?: string }[];
    };
    const counts: Record<string, number> = {};
    for (const l of data.listings || []) {
      if (normalizeListingStatus(l.status) !== "LISTED") continue;
      const cat = canonicalizeCategory(l.category ?? "");
      if (!cat) continue;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export default async function CategoriesPage() {
  const counts = await loadCategoryCounts();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Browse by category
          </h1>
          <p className="mt-2 text-sm text-silver">
            Explore everything listed on Hashpop. Pick a category to see matching items.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_GROUPS.map(({ group, categories }) => {
            const groupTotal = categories.reduce((sum, cat) => sum + (counts[cat] ?? 0), 0);
            return (
              <section
                key={group}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-silver">
                    {group}
                  </h2>
                  <span className="text-[11px] text-silver/50">{groupTotal} listed</span>
                </div>
                <ul className="space-y-1">
                  {categories.map((cat) => {
                    const count = counts[cat] ?? 0;
                    return (
                      <li key={cat}>
                        <Link
                          href={`/marketplace?category=${encodeURIComponent(cat)}`}
                          className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
                        >
                          <span className="text-sm text-white/90 group-hover:text-white">
                            {cat}
                          </span>
                          <span
                            className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              count > 0
                                ? "bg-[#00ffa3]/10 text-[#00ffa3]"
                                : "bg-white/5 text-silver/40"
                            }`}
                          >
                            {count}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

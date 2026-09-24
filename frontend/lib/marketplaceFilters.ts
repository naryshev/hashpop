export type SortMode = "recent" | "price-asc" | "price-desc" | "trending";
export type ListingType = "all" | "physical" | "digital";

export type AdvancedFilterDraft = {
  minPrice: string;
  maxPrice: string;
  postedWithin: string;
  condition: string;
  location: string;
};

type ParamSource = { toString(): string };

function copyParams(params: ParamSource): URLSearchParams {
  return new URLSearchParams(params.toString());
}

export function marketplaceHref(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

/** Listing type writes `type` and clears `category`, matching the old pills. */
export function withListingType(params: ParamSource, type: ListingType): URLSearchParams {
  const next = copyParams(params);
  if (type === "all") next.delete("type");
  else next.set("type", type);
  next.delete("category");
  return next;
}

/** Category writes `category`. Choosing the active category clears it. */
export function withCategory(params: ParamSource, category: string): URLSearchParams {
  const next = copyParams(params);
  if ((next.get("category") ?? "") === category) next.delete("category");
  else next.set("category", category);
  return next;
}

export function withSort(params: ParamSource, sort: SortMode): URLSearchParams {
  const next = copyParams(params);
  if (sort === "recent") next.delete("sort");
  else next.set("sort", sort);
  return next;
}

export function withAdvancedFilters(
  params: ParamSource,
  draft: AdvancedFilterDraft,
): URLSearchParams {
  const next = copyParams(params);
  const write = (key: keyof AdvancedFilterDraft, param: string) => {
    const value = draft[key].trim();
    if (value) next.set(param, value);
    else next.delete(param);
  };
  write("minPrice", "minPrice");
  write("maxPrice", "maxPrice");
  write("postedWithin", "postedWithin");
  write("condition", "condition");
  write("location", "location");
  return next;
}

/** Clears the sheet controls. Leaves the search query (`q`) and view mode alone. */
export function resetMarketplaceFilters(params: ParamSource): URLSearchParams {
  const next = copyParams(params);
  for (const key of [
    "minPrice",
    "maxPrice",
    "postedWithin",
    "condition",
    "location",
    "sort",
    "type",
    "category",
  ]) {
    next.delete(key);
  }
  return next;
}

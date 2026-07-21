// Professional Mode filter state — persists while the user stays in Professional Mode.
// Never applied to People Mode.

export type ProSort = "nearest" | "rating" | "response";

export type ProFilters = {
  availableNow: boolean;
  categories: string[];
  verifiedOnly: boolean;
  minRating: number | null;
  sort: ProSort;
};

export const defaultProFilters: ProFilters = {
  availableNow: false,
  categories: [],
  verifiedOnly: true,
  minRating: null,
  sort: "nearest",
};

let current: ProFilters = { ...defaultProFilters };

export const getProFilters = (): ProFilters => current;
export const setProFilters = (f: ProFilters) => {
  current = f;
};

/** Number of non-default filters — shown as the badge on the Filters button. */
export function activeFilterCount(f: ProFilters): number {
  return (
    (f.availableNow ? 1 : 0) +
    f.categories.length +
    (f.minRating ? 1 : 0) +
    (f.sort !== "nearest" ? 1 : 0) +
    (f.verifiedOnly === defaultProFilters.verifiedOnly ? 0 : 1)
  );
}

export function proFiltersToQuery(f: ProFilters): string {
  const parts: string[] = [];
  if (f.availableNow) parts.push("available_now=true");
  if (f.categories.length) parts.push(`categories=${encodeURIComponent(f.categories.join(","))}`);
  if (f.minRating) parts.push(`min_rating=${f.minRating}`);
  if (f.sort !== "nearest") parts.push(`sort=${f.sort}`);
  if (f.verifiedOnly) parts.push("verified_only=true");
  return parts.length ? `&${parts.join("&")}` : "";
}

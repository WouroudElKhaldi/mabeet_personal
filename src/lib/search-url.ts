// One way to turn search state into a /search URL, shared by tabs, categories and the filters dialog.

export interface SearchState {
  type?: string;
  q?: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  category?: string[];
  tags?: string[];
  amenities?: string[];
  access?: string[];
  minPrice?: number;
  maxPrice?: number;
}

/** Drops empty values and the defaults, so URLs stay short and shareable. */
function searchQuery(state: SearchState): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };
  put("type", state.type && state.type !== "all" ? state.type : undefined);
  put("q", state.q);
  put("area", state.area);
  put("checkIn", state.checkIn);
  put("checkOut", state.checkOut);
  put("guests", state.guests && state.guests > 1 ? state.guests : undefined);
  for (const key of ["category", "tags", "amenities", "access"] as const) put(key, state[key]?.join(","));
  put("minPrice", state.minPrice);
  put("maxPrice", state.maxPrice);
  return params.toString();
}

export const searchHref = (state: SearchState) => {
  const query = searchQuery(state);
  return query ? `/search?${query}` : "/search";
};

/** How many filters (beyond type, words, dates and guests) are on, for the Filters button badge. */
export function activeFilterCount(state: SearchState): number {
  return (
    (state.category?.length ?? 0) +
    (state.tags?.length ?? 0) +
    (state.amenities?.length ?? 0) +
    (state.access?.length ?? 0) +
    (state.minPrice !== undefined ? 1 : 0) +
    (state.maxPrice !== undefined ? 1 : 0)
  );
}

import type { Results } from '@server/models/Search';

export type SearchSortMode = 'relevance' | 'oldest' | 'newest';

const yearDate = (result: Results): string | undefined => {
  switch (result.mediaType) {
    case 'movie':
      return result.releaseDate;
    case 'tv':
      return result.firstAirDate;
    default:
      // Persons and collections carry no release year; the sort pins them last.
      return undefined;
  }
};

/**
 * Orders search results by release year while keeping the relevance order of
 * equally-dated entries. Results without a date (people, collections) always
 * sink to the bottom, in either sort direction.
 */
export const sortSearchResults = <T extends Results>(
  results: T[],
  mode: SearchSortMode
): T[] => {
  if (mode === 'relevance') {
    return [...results];
  }

  return [...results].sort((a, b) => {
    const dateA = yearDate(a);
    const dateB = yearDate(b);

    if (!dateA || !dateB) {
      if (!dateA && !dateB) {
        return 0;
      }
      return dateA ? -1 : 1;
    }

    // TMDB dates are ISO strings (YYYY-MM-DD), which sort lexicographically.
    const order = dateA.localeCompare(dateB);
    return mode === 'newest' ? -order : order;
  });
};

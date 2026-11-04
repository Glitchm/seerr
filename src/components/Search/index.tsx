import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover, { MAX_DRAIN_PAGES } from '@app/hooks/useDiscover';
import useToasts from '@app/hooks/useToasts';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { SearchSortMode } from '@app/utils/searchSort';
import { sortSearchResults } from '@app/utils/searchSort';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Search', {
  search: 'Search',
  searchresults: 'Search Results',
  sortResults: 'Sort results',
  sortRelevance: 'Relevance',
  sortYearNewest: 'Year: Newest',
  sortYearOldest: 'Year: Oldest',
  sortDrainCap:
    'The result set is too large for full year sorting. Sorting the first 1000 results instead.',
});

const sortOptions: {
  key: SearchSortMode;
  label: typeof messages.sortRelevance;
}[] = [
  { key: 'relevance', label: messages.sortRelevance },
  { key: 'newest', label: messages.sortYearNewest },
  { key: 'oldest', label: messages.sortYearOldest },
];

const Search = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();

  const [sortMode, setSortMode] = useState<SearchSortMode>('relevance');
  const [isDraining, setIsDraining] = useState(false);
  const drainInProgress = useRef(false);
  const capNoticeShownFor = useRef('');

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    firstResultData,
    size,
    loadAll,
    fetchMore,
    error,
  } = useDiscover<MovieResult | TvResult | PersonResult>(
    `/api/v1/search`,
    {
      query: router.query.query,
    },
    { hideAvailable: false, hideBlocklisted: false, hideRequested: false }
  );

  const totalPages = firstResultData?.totalPages ?? 0;
  // Year sorting has to be accurate across the whole result set, not the
  // scroll chunk the user has reached so far, so non-relevance modes drain
  // every remaining page (up to the drain cap).
  const drainTarget = totalPages ? Math.min(totalPages, MAX_DRAIN_PAGES) : size;
  const allPagesLoaded = size >= drainTarget;

  // A new search starts in relevance order again.
  useEffect(() => {
    setSortMode('relevance');
  }, [router.query.query]);

  useEffect(() => {
    if (sortMode === 'relevance') {
      return;
    }

    if (totalPages === 0 || allPagesLoaded) {
      return;
    }

    if (drainInProgress.current) {
      return;
    }

    if (totalPages > MAX_DRAIN_PAGES) {
      const query = Array.isArray(router.query.query)
        ? router.query.query[0]
        : router.query.query;

      if (capNoticeShownFor.current !== (query ?? '')) {
        capNoticeShownFor.current = query ?? '';
        addToast(intl.formatMessage(messages.sortDrainCap), {
          appearance: 'info',
          autoDismiss: true,
        });
      }
    }

    drainInProgress.current = true;
    setIsDraining(true);

    void loadAll().finally(() => {
      drainInProgress.current = false;
      setIsDraining(false);
    });
  }, [
    addToast,
    allPagesLoaded,
    intl,
    loadAll,
    router.query.query,
    sortMode,
    totalPages,
  ]);

  const sortedTitles = useMemo(
    () => sortSearchResults(titles, sortMode),
    [sortMode, titles]
  );

  if (error) {
    return <ErrorPage statusCode={500} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.search)} />
      <div className="mb-5 mt-1">
        <Header
          rightSide={
            <div
              aria-label={intl.formatMessage(messages.sortResults)}
              className="flex items-center gap-px rounded bg-gray-500/50 p-0.5"
              role="group"
            >
              {sortOptions.map((option) => (
                <button
                  key={option.key}
                  aria-pressed={sortMode === option.key}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
                    sortMode === option.key
                      ? 'bg-indigo-500 text-white'
                      : 'text-gray-300 hover:bg-gray-500 hover:text-gray-100'
                  }`}
                  onClick={() => setSortMode(option.key)}
                  type="button"
                >
                  {intl.formatMessage(option.label)}
                </button>
              ))}
            </div>
          }
        >
          {intl.formatMessage(messages.searchresults)}
        </Header>
      </div>
      <ListView
        items={sortedTitles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData ||
          ((isLoadingMore || isDraining) && sortedTitles.length > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default Search;

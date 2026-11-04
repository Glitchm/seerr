import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import { MediaStatus } from '@server/constants/media';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import useSWRInfinite from 'swr/infinite';
import useSettings from './useSettings';
import { Permission, useUser } from './useUser';

export interface BaseSearchResult<T> {
  page: number;
  totalResults: number;
  totalPages: number;
  results: T[];
}

// Hard cap on pages drained for sorting (50 x 20 = 1000 titles). TMDB
// relevance pagination degrades long before page 50, and an unbounded drain
// turns a common query into a request flood against TMDB.
export const MAX_DRAIN_PAGES = 50;

const DRAIN_PAGE_DELAY_MS = 250;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

interface BaseMedia {
  id: number;
  mediaType: string;
  mediaInfo?: {
    status: MediaStatus;
    hasActiveRequest?: boolean;
  };
}

interface DiscoverResult<T, S> {
  isLoadingInitialData: boolean;
  isLoadingMore: boolean;
  fetchMore: () => void;
  loadAll: () => Promise<void>;
  isEmpty: boolean;
  isReachingEnd: boolean;
  error: unknown;
  titles: T[];
  size: number;
  firstResultData?: BaseSearchResult<T> & S;
  mutate?: () => void;
}

const extraEncodes: [RegExp, string][] = [
  [/\(/g, '%28'],
  [/\)/g, '%29'],
  [/!/g, '%21'],
  [/\*/g, '%2A'],
];

export const encodeURIExtraParams = (string: string): string => {
  let finalString = encodeURIComponent(string);

  extraEncodes.forEach((encode) => {
    finalString = finalString.replace(encode[0], encode[1]);
  });

  return finalString;
};

const useDiscover = <
  T extends BaseMedia,
  S = Record<string, never>,
  O = Record<string, unknown>,
>(
  endpoint: string,
  options?: O,
  { hideAvailable = true, hideBlocklisted = true, hideRequested = true } = {}
): DiscoverResult<T, S> => {
  const settings = useSettings();
  const { hasPermission } = useUser();
  const { addToast } = useToasts();
  const intl = useIntl();
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<
    BaseSearchResult<T> & S
  >(
    (pageIndex: number, previousPageData) => {
      if (previousPageData && pageIndex + 1 > previousPageData.totalPages) {
        return null;
      }

      const params: Record<string, unknown> = {
        page: pageIndex + 1,
        ...options,
      };

      const finalQueryString = Object.keys(params)
        .map(
          (paramKey) =>
            `${paramKey}=${encodeURIExtraParams(params[paramKey] as string)}`
        )
        .join('&');

      return `${endpoint}?${finalQueryString}`;
    },
    {
      initialSize: 3,
      revalidateFirstPage: false,
      dedupingInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  const resultIds: Set<number> = new Set<number>();

  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 &&
      !!data &&
      typeof data[size - 1] === 'undefined' &&
      isValidating);

  const fetchMore = () => {
    setSize(size + 1);
  };

  /**
   * Drains the remaining result pages sequentially (paced so upstream TMDB is
   * not flooded) so a sort over the returned `titles` covers the full result set.
   */
  const loadAll = async (): Promise<void> => {
    const target = Math.min(data?.[0]?.totalPages ?? 0, MAX_DRAIN_PAGES);

    if (target === 0) {
      return;
    }

    for (let page = size; page < target; page++) {
      // Functional update keeps the page count monotonic if a scroll fetch
      // raced ahead mid-drain.
      await setSize((current) => Math.max(current, page + 1));
      await sleep(DRAIN_PAGE_DELAY_MS);
    }
  };

  let titles = (data ?? []).reduce((a, v) => {
    const results: T[] = [];

    for (const result of v.results) {
      if (!resultIds.has(result.id)) {
        resultIds.add(result.id);
        results.push(result);
      }
    }

    return [...a, ...results];
  }, [] as T[]);

  if (settings.currentSettings.hideAvailable && hideAvailable) {
    titles = titles.filter(
      (i) =>
        !(i.mediaType === 'movie' || i.mediaType === 'tv') ||
        (i.mediaInfo?.status !== MediaStatus.AVAILABLE &&
          i.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE)
    );
  }

  if (
    settings.currentSettings.hideBlocklisted &&
    hideBlocklisted &&
    hasPermission(Permission.MANAGE_BLOCKLIST)
  ) {
    titles = titles.filter(
      (i) =>
        !(i.mediaType === 'movie' || i.mediaType === 'tv') ||
        i.mediaInfo?.status !== MediaStatus.BLOCKLISTED
    );
  }

  if (settings.currentSettings.hideRequested && hideRequested) {
    titles = titles.filter((i) => {
      if (i.mediaType !== 'movie' && i.mediaType !== 'tv') {
        return true;
      }

      return !i.mediaInfo?.hasActiveRequest;
    });
  }

  const isEmpty = !isLoadingInitialData && titles?.length === 0;
  const isReachingEnd =
    isEmpty ||
    (!!data && (data[data?.length - 1]?.results.length ?? 0) < 20) ||
    (!!data &&
      (data[data?.length - 1]?.totalResults ?? 0) <=
        (data?.length ?? 0) * 20) ||
    (!!data && (data[data?.length - 1]?.totalResults ?? 0) < 41);

  useEffect(() => {
    if (error && titles.length) {
      addToast(intl.formatMessage(globalMessages.error), {
        appearance: 'error',
        autoDismiss: true,
      });
      console.error('Error while fetching discover titles:', error);
    }
  }, [data, error, addToast, intl, titles.length]);

  return {
    isLoadingInitialData,
    isLoadingMore,
    fetchMore,
    loadAll,
    isEmpty,
    isReachingEnd,
    error: error && titles.length ? null : error,
    titles,
    size,
    firstResultData: data?.[0],
    mutate,
  };
};

export default useDiscover;

export interface EpisodeRequestPayload {
  seasonNumber: number;
  episodeNumbers: number[];
}

export interface EpisodeSelection {
  seasonNumber: number;
  episodeNumbers: number[];
}

export interface TmdbSeasonInfo {
  season_number: number;
  episode_count: number;
}

export interface ResolvedEpisodeSelections {
  fullSeasons: number[];
  partialSeasons: EpisodeSelection[];
}

export class InvalidEpisodeSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEpisodeSelectionError';
  }
}

/**
 * Merges the requested whole seasons (`requestedSeasons`) with per-episode
 * selections (`episodeRequests`) into full seasons and partial episode picks.
 *
 * A selection covering every episode of a season is promoted to a full season.
 * Throws an InvalidEpisodeSelectionError when a selection references a season
 * or episode that does not exist, when specials are disabled, when seasons
 * and episodes contradict each other, or when a season is requested both
 * fully and partially.
 */
export const resolveEpisodeSelections = (
  requestedSeasons: number[] | 'all' | undefined,
  episodeRequests: EpisodeRequestPayload[] | undefined,
  tmdbSeasons: TmdbSeasonInfo[],
  enableSpecialEpisodes: boolean
): ResolvedEpisodeSelections => {
  let fullSeasons: number[];
  if (requestedSeasons === 'all') {
    if (episodeRequests?.length) {
      throw new InvalidEpisodeSelectionError(
        'Episodes cannot be selected when requesting all seasons.'
      );
    }
    fullSeasons = tmdbSeasons
      .filter(
        (season) => season.season_number !== 0 && season.episode_count > 0
      )
      .map((season) => season.season_number);
  } else if (requestedSeasons == null) {
    throw new InvalidEpisodeSelectionError(
      'Either seasons or episodes must be selected.'
    );
  } else {
    fullSeasons = [...new Set(requestedSeasons)];
    if (!enableSpecialEpisodes) {
      fullSeasons = fullSeasons.filter((sn) => sn > 0);
    }
  }

  const groupedSelections = new Map<number, Set<number>>();
  for (const request of episodeRequests ?? []) {
    const existing = groupedSelections.get(request.seasonNumber) ?? new Set();
    for (const ep of request.episodeNumbers ?? []) {
      existing.add(ep);
    }
    groupedSelections.set(request.seasonNumber, existing);
  }

  const partialSeasons: EpisodeSelection[] = [];
  for (const [seasonNumber, episodeNumbers] of groupedSelections) {
    if (!enableSpecialEpisodes && seasonNumber === 0) {
      throw new InvalidEpisodeSelectionError(
        'Special episodes are disabled for this server.'
      );
    }
    if (fullSeasons.includes(seasonNumber)) {
      throw new InvalidEpisodeSelectionError(
        `Season ${seasonNumber} is requested in full and by episode; pick one.`
      );
    }
    const tmdbSeason = tmdbSeasons.find(
      (season) => season.season_number === seasonNumber
    );
    if (!tmdbSeason || (tmdbSeason.episode_count ?? 0) <= 0) {
      throw new InvalidEpisodeSelectionError(
        `Season ${seasonNumber} does not exist on this title.`
      );
    }
    const invalid = [...episodeNumbers].filter(
      (ep) => !Number.isInteger(ep) || ep < 1 || ep > tmdbSeason.episode_count
    );
    if (invalid.length > 0) {
      throw new InvalidEpisodeSelectionError(
        `Season ${seasonNumber} has no episode(s) ${invalid.join(', ')}.`
      );
    }
    const picked = [...episodeNumbers].sort((a, b) => a - b);
    if (picked.length === tmdbSeason.episode_count) {
      fullSeasons.push(seasonNumber);
    } else {
      partialSeasons.push({ seasonNumber, episodeNumbers: picked });
    }
  }

  fullSeasons = [...new Set(fullSeasons)].sort((a, b) => a - b);
  partialSeasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  return { fullSeasons, partialSeasons };
};

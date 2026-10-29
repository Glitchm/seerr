import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InvalidEpisodeSelectionError,
  resolveEpisodeSelections,
} from '@server/lib/episodeSelections';

describe('resolveEpisodeSelections', () => {
  const tmdbSeasons = [
    { season_number: 0, episode_count: 2 },
    { season_number: 1, episode_count: 10 },
    { season_number: 2, episode_count: 8 },
    { season_number: 3, episode_count: 6 },
  ];

  it('turns "all" into every non-special season with episodes', () => {
    const { fullSeasons, partialSeasons } = resolveEpisodeSelections(
      'all',
      undefined,
      tmdbSeasons,
      true
    );

    assert.deepEqual(fullSeasons, [1, 2, 3]);
    assert.deepEqual(partialSeasons, []);
  });

  it('"all" respects the specials toggle', () => {
    const { fullSeasons } = resolveEpisodeSelections(
      'all',
      undefined,
      tmdbSeasons,
      false
    );

    assert.deepEqual(fullSeasons, [1, 2, 3]);
  });

  it('keeps an explicit numbers list and dedupes it', () => {
    const { fullSeasons } = resolveEpisodeSelections(
      [3, 1, 3],
      undefined,
      tmdbSeasons,
      true
    );

    assert.deepEqual(fullSeasons, [1, 3]);
  });

  it('returns partial selections sorted, merged and deduped', () => {
    const { fullSeasons, partialSeasons } = resolveEpisodeSelections(
      [2],
      [
        { seasonNumber: 1, episodeNumbers: [4, 2] },
        { seasonNumber: 1, episodeNumbers: [2, 9] },
      ],
      tmdbSeasons,
      true
    );

    assert.deepEqual(fullSeasons, [2]);
    assert.deepEqual(partialSeasons, [
      { seasonNumber: 1, episodeNumbers: [2, 4, 9] },
    ]);
  });

  it('promotes a selection covering every episode to a full season', () => {
    const { fullSeasons, partialSeasons } = resolveEpisodeSelections(
      [1],
      [
        {
          seasonNumber: 3,
          episodeNumbers: [6, 1, 2, 3, 4, 5],
        },
      ],
      tmdbSeasons,
      true
    );

    assert.deepEqual(fullSeasons, [1, 3]);
    assert.deepEqual(partialSeasons, []);
  });

  it('rejects episode numbers that do not exist', () => {
    assert.throws(
      () =>
        resolveEpisodeSelections(
          [],
          [{ seasonNumber: 1, episodeNumbers: [5, 11] }],
          tmdbSeasons,
          true
        ),
      (e: Error) =>
        e instanceof InvalidEpisodeSelectionError &&
        e.message.includes('no episode(s) 11')
    );
  });

  it('rejects seasons that do not exist on the title', () => {
    assert.throws(
      () =>
        resolveEpisodeSelections(
          [],
          [{ seasonNumber: 9, episodeNumbers: [1] }],
          tmdbSeasons,
          true
        ),
      InvalidEpisodeSelectionError
    );
  });

  it('blocks specials when they are disabled', () => {
    assert.throws(
      () =>
        resolveEpisodeSelections(
          [],
          [{ seasonNumber: 0, episodeNumbers: [1] }],
          tmdbSeasons,
          false
        ),
      InvalidEpisodeSelectionError
    );
  });

  it('rejects mixing "all" with episode selections', () => {
    assert.throws(
      () =>
        resolveEpisodeSelections(
          'all',
          [{ seasonNumber: 1, episodeNumbers: [1] }],
          tmdbSeasons,
          true
        ),
      (e: Error) =>
        e instanceof InvalidEpisodeSelectionError &&
        e.message.includes('requesting all seasons')
    );
  });

  it('rejects a season requested both fully and partially', () => {
    assert.throws(
      () =>
        resolveEpisodeSelections(
          [1],
          [{ seasonNumber: 1, episodeNumbers: [2] }],
          tmdbSeasons,
          true
        ),
      InvalidEpisodeSelectionError
    );
  });

  it('rejects requests with neither seasons nor episodes', () => {
    assert.throws(
      () => resolveEpisodeSelections(undefined, undefined, tmdbSeasons, true),
      InvalidEpisodeSelectionError
    );
  });
});

import type {
  MovieResult,
  PersonResult,
  Results,
  TvResult,
} from '@server/models/Search';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortSearchResults } from './searchSort';

const movie = (id: number, releaseDate: string): MovieResult => ({
  id,
  mediaType: 'movie',
  adult: false,
  video: false,
  popularity: 0,
  voteAverage: 0,
  voteCount: 0,
  genreIds: [],
  overview: '',
  originalLanguage: 'en',
  originalTitle: `Movie ${id}`,
  title: `Movie ${id}`,
  releaseDate,
});

const tv = (id: number, firstAirDate: string): TvResult => ({
  id,
  mediaType: 'tv',
  popularity: 0,
  voteAverage: 0,
  voteCount: 0,
  genreIds: [],
  overview: '',
  originalLanguage: 'en',
  originalName: `Series ${id}`,
  name: `Series ${id}`,
  originCountry: [],
  firstAirDate,
});

const person = (id: number, name: string): PersonResult => ({
  id,
  mediaType: 'person',
  name,
  adult: false,
  popularity: 0,
  knownFor: [],
});

const ids = (results: Results[]) => results.map((result) => result.id);

describe('sortSearchResults', () => {
  const newest = movie(1, '2019-01-02');
  const middle = tv(2, '2004-04-01');
  const oldest = movie(3, '1985-02-03');
  const welker = person(4, 'Frank Welker');
  const mixed = [newest, middle, oldest, welker];

  it('keeps the existing order in relevance mode', () => {
    const sorted = sortSearchResults(mixed, 'relevance');

    assert.deepEqual(ids(sorted), [1, 2, 3, 4]);
  });

  it('orders newest first across movies and series', () => {
    const sorted = sortSearchResults(mixed, 'newest');

    assert.deepEqual(ids(sorted), [1, 2, 3, 4]);
  });

  it('orders oldest first across movies and series', () => {
    const sorted = sortSearchResults(mixed, 'oldest');

    assert.deepEqual(ids(sorted), [3, 2, 1, 4]);
  });

  it('pins undated results to the bottom in both directions', () => {
    const undated = person(5, 'Uncredited Voice');
    const newestUndated = sortSearchResults([undated, ...mixed], 'newest');
    const oldestUndated = sortSearchResults([undated, ...mixed], 'oldest');

    // Undated results sink below every dated result; their mutual order is
    // preserved relative to the input (stable sort).
    assert.deepEqual(ids(newestUndated), [1, 2, 3, 5, 4]);
    assert.deepEqual(ids(oldestUndated), [3, 2, 1, 5, 4]);
  });

  it('keeps equally-dated entries in their original order', () => {
    const first = movie(10, '1998-10-23');
    const second = movie(11, '1998-10-23');

    const sortedOldest = sortSearchResults([second, first], 'oldest');
    const sortedNewest = sortSearchResults([second, first], 'newest');

    assert.deepEqual(ids(sortedOldest), [11, 10]);
    assert.deepEqual(ids(sortedNewest), [11, 10]);
  });

  it('handles an empty result list without sorting', () => {
    assert.deepEqual(sortSearchResults([], 'newest'), []);
  });
});

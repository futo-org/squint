import { describe, expect, it } from 'vitest';
import { toBuildFilter, toProjectFilter, toSearch } from './filter.js';

describe(toBuildFilter.name, () => {
  it('reads the search and every filter from the address', () => {
    const params = new URLSearchParams(
      'query=button&review=needs-review&kind=pull-request&pullRequestState=open&branch=feat%2Fx',
    );

    expect(toBuildFilter(params)).toEqual({
      query: 'button',
      review: 'needs-review',
      kind: 'pull-request',
      pullRequestState: 'open',
      branch: 'feat/x',
    });
  });

  it('is empty for an address without filters', () => {
    expect(toBuildFilter(new URLSearchParams())).toEqual({});
  });

  it.each(['review=rejected', 'kind=nightly', 'pullRequestState=draft', 'query=', 'query=%20%20', 'branch='])(
    'ignores %s',
    (search) => {
      expect(toBuildFilter(new URLSearchParams(search))).toEqual({});
    },
  );

  it('trims the search', () => {
    expect(toBuildFilter(new URLSearchParams('query=%20button%20'))).toEqual({ query: 'button' });
  });
});

describe(toProjectFilter.name, () => {
  it('reads the search and the repository', () => {
    const params = new URLSearchParams('query=ui&repository=immich-app%2Fstatic-pages&kind=main');

    expect(toProjectFilter(params)).toEqual({ query: 'ui', repository: 'immich-app/static-pages' });
  });
});

describe(toSearch.name, () => {
  it('writes only the filters that are set', () => {
    expect(toSearch({ query: 'button radius', review: undefined, branch: 'feat/x' })).toBe(
      '?query=button+radius&branch=feat%2Fx',
    );
  });

  it('is empty when nothing is set', () => {
    expect(toSearch({ query: undefined })).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { coverageSummary } from '../scripts/coverage-result.js';
describe('live coverage accounting', () => {
  it('does not hide matching network failures or unmapped hosts as successes', () => {
    const summary = coverageSummary([{ kind: 'asset', name: 'unavailable', upstream: 0, proxy: 0, detail: 'Timeout' }, { kind: 'asset', name: 'unknown', upstream: 0, proxy: 0, detail: 'unmapped asset host: assets.example' }, { kind: 'asset', name: 'private', upstream: 403, proxy: 403 }, { kind: 'asset', name: 'range', upstream: 206, proxy: 206, identical: true }]);
    expect(summary).toEqual({ checks: 4, discrepancies: 1, inconclusive: 1, upstreamFailures: 1, passed: false });
  });
  it('requires both status and bytes to match a successful response', () => { expect(coverageSummary([{ kind: 'asset', name: 'ok', upstream: 206, proxy: 206, identical: true }]).passed).toBe(true); expect(coverageSummary([{ kind: 'asset', name: 'corrupt', upstream: 206, proxy: 206, identical: false }]).passed).toBe(false); });
});

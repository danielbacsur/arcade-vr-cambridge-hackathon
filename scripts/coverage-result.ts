export interface CoverageResult { kind: string; name: string; upstream: number; proxy: number; bytes?: number; identical?: boolean; detail?: string }
export function coverageSummary(results: CoverageResult[]) {
  const discrepancies = results.filter(row => row.upstream !== row.proxy || row.identical === false || row.detail === 'adapter missing' || row.detail?.startsWith('unmapped asset host:'));
  const inconclusive = results.filter(row => !discrepancies.includes(row) && (!row.upstream || !row.proxy));
  const upstreamFailures = results.filter(row => row.upstream >= 400 && !discrepancies.includes(row));
  return { checks: results.length, discrepancies: discrepancies.length, inconclusive: inconclusive.length, upstreamFailures: upstreamFailures.length, passed: discrepancies.length === 0 && inconclusive.length === 0 && upstreamFailures.length === 0 };
}

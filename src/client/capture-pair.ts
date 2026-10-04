/** Keep successful bitmap allocations from leaking when the other GPU capture fails. */
export async function capturePair<T extends { close(): void }>(image: Promise<T>, overlay: Promise<T | undefined>): Promise<[T, T | undefined]> {
  const results = await Promise.allSettled([image, overlay] as const);
  if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') return [results[0].value, results[1].value];
  for (const result of results) if (result.status === 'fulfilled') result.value?.close();
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected'); throw failure?.reason || Error('GPU capture failed');
}

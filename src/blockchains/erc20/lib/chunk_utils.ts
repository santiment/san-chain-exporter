export function buildInclusiveChunks(start: number, end: number, chunkSize: number): [number, number][] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize should be positive');
  }

  if (end < start) {
    return [];
  }

  const chunks: [number, number][] = [];
  for (let currentStart = start; currentStart <= end; currentStart += chunkSize) {
    const currentEnd = Math.min(currentStart + chunkSize - 1, end);
    chunks.push([currentStart, currentEnd]);
  }

  return chunks;
}

/**
 * Intersection calculation utilities for heatmap score combination.
 */

/**
 * Calculates intersection score using multiplication method.
 * Multiplies all normalized scores together.
 * @param scores - Array of normalized scores (0-1 range)
 * @returns Combined score as product of all scores
 */
export function calculateMultiplyScore(scores: number[]): number {
    return scores.reduce((a, b) => a * b, 1);
}

/**
 * Calculates intersection score using threshold filter method.
 * Returns average of scores only if ALL scores pass the threshold.
 * @param scores - Array of normalized scores (0-1 range)
 * @param threshold - Minimum score threshold (0-1 range)
 * @returns Average of scores if all pass threshold, 0 otherwise
 */
export function calculateThresholdScore(scores: number[], threshold: number): number {
    const passesAll = scores.every(s => s >= threshold);
    return passesAll ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}



/**
 * Calculates the percentile rank for each score in the array.
 * Percentile indicates what percentage of scores fall below each value.
 * @param scores - Array of raw scores
 * @returns Array of percentile ranks (0-100) corresponding to each input score
 */
export function percentile(scores: number[]): number[] {
    const n = scores.length;
    if (n === 0) return [];
    if (n === 1) return [50];
    const indexed = scores.map((score, idx) => ({ score, idx }));
    indexed.sort((a, b) => a.score - b.score);
    const percentiles = new Array<number>(n);
    for (let rank = 0; rank < n; rank++) {
        const percentileRank = ((rank + 0.5) / n) * 100;
        percentiles[indexed[rank].idx] = percentileRank;
    }

    return percentiles;
}

/** Filters points to only those at or above a given percentile threshold. */
export function filterByPercentile<T extends { score: number }>(
    data: T[],
    minPercentile: number
): T[] {
    if (data.length === 0 || minPercentile <= 0) return data;
    const scores = data.map(p => p.score);
    const pcts = percentile(scores);
    return data.filter((_, idx) => pcts[idx] >= minPercentile);
}
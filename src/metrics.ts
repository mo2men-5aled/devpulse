export interface BenchmarkMetrics {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

export function calculateMetrics(samples: number[]): BenchmarkMetrics {
  if (samples.length === 0) {
    throw new Error("No samples provided to calculate metrics.");
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  return { min, max, avg, p95, p99 };
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.floor(sorted.length * fraction);
  return sorted[Math.min(index, sorted.length - 1)];
}

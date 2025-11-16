import axios from "axios";
import chalk from "chalk";
import { calculateMetrics } from "./metrics.js";


export default async function runBenchmark(
  url: string,
  { concurrency, requests }: { concurrency: string; requests: string }
) {
  const concurrencyNum = Number(concurrency);
  const requestsNum = Number(requests);

  let completed = 0;
  let failed = 0;
  let times: number[] = [];

  console.log(chalk.yellow(`🏎 Running ${requestsNum} requests with concurrency ${concurrencyNum}\n`));

  const run = async () => {
    for (let i = 0; i < requestsNum / concurrencyNum; i++) {
      const start = performance.now();
      try {
        await axios.get(url);
        const end = performance.now();
        times.push(end - start);
        completed++;
      } catch (e) {
        failed++;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrencyNum }, run));

    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const metrics = calculateMetrics(times);

    console.log(chalk.green(`✔ Completed: ${completed}`));
    console.log(chalk.red(`✖ Failed: ${failed}`));
    console.log(chalk.blue(`⏱ Avg: ${metrics.avg.toFixed(2)}ms`));
    console.log(chalk.blue(`📉 Min: ${metrics.min.toFixed(2)}ms`));
    console.log(chalk.blue(`📈 Max: ${metrics.max.toFixed(2)}ms`));
    console.log(chalk.blue(`🎯 p95: ${metrics.p95.toFixed(2)}ms`));
    console.log(chalk.blue(`🎯 p99: ${metrics.p99.toFixed(2)}ms\n`));
    
    return {
      completed,
      failed,
      metrics,
    };

}

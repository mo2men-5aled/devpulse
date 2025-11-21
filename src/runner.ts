import axios from "axios";
import chalk from "chalk";
import * as cliProgress from 'cli-progress';
import { calculateMetrics } from "./metrics.js";

export default async function runBenchmark(
  url: string,
  { concurrency, requests }: { concurrency: string; requests: string }
) {
  const concurrencyNum = Number(concurrency);
  const requestsNum = Number(requests);

  // Using a mutex to ensure thread-safe access to shared variables
  const mutex = {
    locked: false,
    lock: async () => {
      while (mutex.locked) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      mutex.locked = true;
    },
    unlock: () => {
      mutex.locked = false;
    }
  };

  let completed = 0;
  let failed = 0;
  let times: number[] = [];

  // Create a new progress bar instance
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | ETA: {eta}s | {speed} req/sec',
    barCompleteChar: '\u25A0',
    barIncompleteChar: '\u25A1',
    hideCursor: true
  });

  console.log(chalk.yellow(`🏎 Running ${requestsNum} requests with concurrency ${concurrencyNum}\n`));

  // Initialize the progress bar
  progressBar.start(requestsNum, 0);

  // Track start time for speed calculation
  const startTime = Date.now();

  const updateProgress = async () => {
    await mutex.lock();
    const totalCompleted = completed + failed;
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const speed = elapsedSeconds > 0 ? (totalCompleted / elapsedSeconds).toFixed(2) : '0.00';
    progressBar.update(totalCompleted, {
      speed: speed
    });
    mutex.unlock();
  };

  // Main worker function that runs each concurrent thread
  const runWorker = async () => {
    for (let i = 0; i < Math.ceil(requestsNum / concurrencyNum); i++) {
      // Check if we've already processed all requests
      await mutex.lock();
      const currentTotal = completed + failed;
      mutex.unlock();

      if (currentTotal >= requestsNum) {
        break;
      }

      const start = Date.now();
      try {
        await axios.get(url);
        const end = Date.now();
        const duration = end - start;

        await mutex.lock();
        times.push(duration);
        completed++;
        mutex.unlock();
      } catch (error) {
        await mutex.lock();
        failed++;
        mutex.unlock();
      } finally {
        await updateProgress();
      }
    }
  };

  // Run all workers concurrently
  await Promise.all(
    Array.from({ length: concurrencyNum }, runWorker)
  );

  // Ensure final progress update and cleanup
  await updateProgress();

  // Stop the progress bar
  progressBar.stop();

  // Show completion message
  console.log(chalk.green('\n✅ Benchmark completed!\n'));

  const metrics = calculateMetrics(times);

  // Enhanced output with colors
  console.log(`${chalk.green('✔ Completed:')} ${chalk.bold.green(completed)}`);
  console.log(`${chalk.red('✖ Failed:')} ${chalk.bold.red(failed)}`);
  console.log(`${chalk.blue('⏱ Avg:')} ${chalk.bold.blue(`${metrics.avg.toFixed(2)}ms`)}`);
  console.log(`${chalk.blue('📉 Min:')} ${chalk.bold.blue(`${metrics.min.toFixed(2)}ms`)}`);
  console.log(`${chalk.blue('📈 Max:')} ${chalk.bold.blue(`${metrics.max.toFixed(2)}ms`)}`);
  console.log(`${chalk.magenta('🎯 p95:')} ${chalk.bold.magenta(`${metrics.p95.toFixed(2)}ms`)}`);
  console.log(`${chalk.magenta('🎯 p99:')} ${chalk.bold.magenta(`${metrics.p99.toFixed(2)}ms`)}\n`);

  return {
    completed,
    failed,
    metrics,
  };
}

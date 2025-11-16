import axios from "axios";
import chalk from "chalk";
import * as cliProgress from 'cli-progress';
import { calculateMetrics } from "./metrics.js";

// Simple spinner implementation
class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private currentFrame = 0;

  start(message: string) {
    process.stdout.write(`\n${chalk.blue(this.frames[this.currentFrame])} ${message}`);
    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      process.stdout.write(`\r${chalk.blue(this.frames[this.currentFrame])} ${message}`);
    }, 100);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r\x1b[K'); // Clear the line
    }
  }
}

export default async function runBenchmark(
  url: string,
  { concurrency, requests }: { concurrency: string; requests: string }
) {
  const concurrencyNum = Number(concurrency);
  const requestsNum = Number(requests);

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

  // Add an overall spinner for the entire operation
  const spinner = new Spinner();
  spinner.start('Benchmarking in progress...');

  // Use a more robust approach to handle concurrent updates to shared variables
  const updateProgress = () => {
    const totalCompleted = completed + failed;
    const elapsedSeconds = performance.now() / 1000;
    const speed = elapsedSeconds > 0 ? (totalCompleted / elapsedSeconds).toFixed(2) : '0.00';
    progressBar.update(totalCompleted, {
      speed: speed
    });
  };

  const run = async () => {
    for (let i = 0; i < requestsNum / concurrencyNum; i++) {
      const start = performance.now();
      try {
        await axios.get(url);
        const end = performance.now();
        times.push(end - start);
      } catch (e) {
        failed++;
      } finally {
        completed++; // increment regardless of success/failure to track total requests
      }

      // Update progress bar after each request
      updateProgress();
    }
  };

  await Promise.all(Array.from({ length: concurrencyNum }, run));

  // Ensure final progress update
  const finalTotal = completed + failed;
  const finalElapsedSeconds = performance.now() / 1000;
  const finalSpeed = finalElapsedSeconds > 0 ? (finalTotal / finalElapsedSeconds).toFixed(2) : '0.00';
  progressBar.update(finalTotal, {
    speed: finalSpeed
  });

  // Stop the progress bar
  progressBar.stop();

  // Stop the spinner
  spinner.stop();

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

import { Command } from "commander";
import chalk from "chalk";
import runBenchmark from "./runner.ts";
import { exportJSON, exportMarkdown } from "./reporter.ts";

const program = new Command();

program
  .name("devpulse")
  .description("CLI tool to benchmark API performance")
  .version("0.1.0");

program
  .command("run")
  .argument("<url>", "API endpoint to benchmark")
  .option("-c, --concurrency <number>", "Concurrent requests", "10")
  .option("-n, --requests <number>", "Total requests", "100")
  .option("--json <path>", "Export results to JSON file")
  .option("--md <path>", "Export results to Markdown file")
  .action(async (url: string, options: any) => {
    console.log(chalk.cyan(`🔍 Benchmarking ${url} ...`));

    const result = await runBenchmark(url, options);

    if (options.json) exportJSON(result, options.json);
    if (options.md) exportMarkdown(result, options.md);
  });

program.parse();

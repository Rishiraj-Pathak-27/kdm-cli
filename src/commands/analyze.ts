import { Command } from 'commander';
import chalk from 'chalk';
import { runAnalysis } from '../analysis/analysis';
import { formatJsonOutput, formatTextOutput } from '../analysis/output';
import type { AnalysisOptions } from '../analysis/types';
import { createSpinner } from '../ui/spinner';
import { logger } from '../utils/logger';

/**
 * Helper to collect multiple filter flags from the CLI options into an array.
 * @param value The newly passed filter option.
 * @param previous Accumulator list of previously collected filters.
 * @returns Array containing all collected filters.
 */
const collectFilter = (value: string, previous: string[]) => [...previous, value];

/**
 * Validates and normalizes the output format choice.
 * @param output The user-selected output format string.
 * @returns The validated output format 'json' or 'text'.
 * @throws An Error if the format is invalid.
 */
const parseOutput = (output: string): AnalysisOptions['output'] => {
  if (output === 'json' || output === 'text') return output;
  throw new Error('Output format must be either "text" or "json"');
};

/**
 * Registers the `analyze` command and its options on the Commander program.
 * @param program Commander program instance.
 */
export const registerAnalyzeCommand = (program: Command) => {
  program
    .command('analyze')
    .alias('analyse')
    .description('Analyze Kubernetes resources for common workload problems')
    .option('-n, --namespace <namespace>', 'Namespace to analyze')
    .option('-L, --selector <selector>', 'Label selector to filter Kubernetes resources')
    .option('-f, --filter <filter>', 'Analyzer filter to run, such as Pod or Deployment', collectFilter, [])
    .option('-o, --output <format>', 'Output format: text or json', 'text')
    .option('-m, --max-concurrency <number>', 'Maximum number of analyzers to run concurrently', '10')
    .option('-s, --with-stat', 'Print analyzer execution stats')
    .option('--with-doc', 'Reserve Kubernetes documentation lookup for analyzer output')
    .option('--kubeconfig <path>', 'Path to kubeconfig file')
    .option('--kubecontext <context>', 'Kubernetes context to use')
    .action(async (options) => {
      let output: AnalysisOptions['output'] = 'text';
      let spinner: ReturnType<typeof createSpinner> | null = null;

      const abortController = new AbortController();
      const onSigint = () => {
        abortController.abort();
        spinner?.fail('Analysis cancelled');
        process.exitCode = 130;
      };
      process.on('SIGINT', onSigint);

      try {
        output = parseOutput(options.output);
        spinner = output === 'json' ? null : createSpinner('Analyzing Kubernetes resources...').start();
        const result = await runAnalysis({
          filters: options.filter.length ? options.filter : undefined,
          namespace: options.namespace,
          labelSelector: options.selector,
          output,
          maxConcurrency: Number.parseInt(options.maxConcurrency, 10),
          withStats: Boolean(options.withStat),
          withDocs: Boolean(options.withDoc),
          kubeconfig: options.kubeconfig,
          kubecontext: options.kubecontext,
          signal: abortController.signal,
        });

        spinner?.stop('Analysis complete');
        console.log(output === 'json' ? formatJsonOutput(result) : formatTextOutput(result));
      } catch (error) {
        spinner?.fail(`Analysis failed: ${(error as Error).message}`);
        if (output === 'json') {
          logger.error(JSON.stringify({ error: (error as Error).message }, null, 2));
        } else {
          logger.error(chalk.red(`Analysis failed: ${(error as Error).message}`));
        }
        process.exitCode = 1;
      } finally {
        process.removeListener('SIGINT', onSigint);
      }
    });
};

import { Command } from 'commander';
import chalk from 'chalk';
import { runAnalysis } from '../analysis/analysis';
import { formatJsonOutput, formatTextOutput } from '../analysis/output';
import type { AnalysisOptions } from '../analysis/types';
import { createSpinner } from '../ui/spinner';

const collectFilter = (value: string, previous: string[]) => [...previous, value];

const parseOutput = (output: string): AnalysisOptions['output'] => {
  if (output === 'json' || output === 'text') return output;
  throw new Error('Output format must be either "text" or "json"');
};

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
        });

        spinner?.stop('Analysis complete');
        console.log(output === 'json' ? formatJsonOutput(result) : formatTextOutput(result));
      } catch (error) {
        spinner?.fail(`Analysis failed: ${(error as Error).message}`);
        if (output === 'json') {
          console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
        } else {
          console.error(chalk.red(`Analysis failed: ${(error as Error).message}`));
        }
        process.exitCode = 1;
      }
    });
};

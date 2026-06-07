import { AnalysisOptions, AnalysisOutput, AnalysisStats } from './types';
import { registry } from '../analyzers';
import { measureDuration } from './stats';
import { getActiveFilters, getAIConfig } from '../config/store';
import { Analyzer, AnalyzerResult } from '../analyzers/types';

const DEFAULT_FILTERS = ['Pod', 'Deployment', 'Service', 'PersistentVolumeClaim', 'Node'];
const MAX_ALLOWED_CONCURRENCY = 100;
const DEFAULT_CONCURRENCY = 10;

/**
 * Resolves the list of filters to be run based on option inputs, default configuration,
 * or active filters stored in the client settings.
 * @param options Options passed to the analysis run.
 * @returns An array of string filter names.
 */
function resolveFilters(options: AnalysisOptions): string[] {
  if (options.filters?.length) {
    return options.filters;
  }
  const active = getActiveFilters();
  return active.length > 0 ? active : DEFAULT_FILTERS;
}

/**
 * Resolves filter strings to their corresponding Analyzer implementations from the registry.
 * Appends error messages to the errors array if a filter name is unrecognized.
 * @param filters The names of the filters to resolve.
 * @param errors The array of error strings to log unknown filters.
 * @returns Resolved Analyzer instances.
 */
function resolveAnalyzers(filters: string[], errors: string[]): Analyzer[] {
  const analyzers: Analyzer[] = [];
  for (const filter of filters) {
    const analyzer = registry.get(filter);
    if (analyzer) {
      analyzers.push(analyzer);
    } else {
      errors.push(`Unknown filter: ${filter}`);
    }
  }
  return analyzers;
}

/**
 * Parses and bounds the concurrency limit within the minimum and maximum constraints.
 * @param maxConcurrency User provided concurrency limit or undefined.
 * @returns Valid concurrency limit integer.
 */
function resolveConcurrencyLimit(maxConcurrency: number | undefined): number {
  if (maxConcurrency === undefined) return DEFAULT_CONCURRENCY;
  if (typeof maxConcurrency !== 'number') return DEFAULT_CONCURRENCY;
  if (!Number.isInteger(maxConcurrency) || maxConcurrency <= 0) return DEFAULT_CONCURRENCY;
  return Math.min(maxConcurrency, MAX_ALLOWED_CONCURRENCY);
}

/**
 * Attaches the currently configured default AI provider metadata to the analysis output.
 * Swallows exceptions to remain fail-safe in non-configured environments.
 * @param output The analysis output object.
 */
function tryAttachProvider(output: AnalysisOutput): void {
  try {
    const aiConfig = getAIConfig();
    if (aiConfig?.defaultProvider) {
      output.provider = aiConfig.defaultProvider;
    }
  } catch {
    // Fail-safe if store isn't initialized or fails to load in specific environments
  }
}

/**
 * Executes a full Kubernetes analysis run across selected analyzers in parallel,
 * respecting concurrency limits and monitoring cancellation signals.
 * @param options Options configuration directing namespace, filters, context, and stats.
 * @returns Aggregated analysis results containing status, problems, and stats.
 */
export async function runAnalysis(options: AnalysisOptions): Promise<AnalysisOutput> {
  const errors: string[] = [];
  const results: AnalyzerResult[] = [];
  const stats: AnalysisStats[] = [];

  const filters = resolveFilters(options);
  const analyzersToRun = resolveAnalyzers(filters, errors);
  const limit = resolveConcurrencyLimit(options.maxConcurrency);

  const context = {
    namespace: options.namespace,
    labelSelector: options.labelSelector,
    kubeconfig: options.kubeconfig,
    kubecontext: options.kubecontext,
    withDocs: options.withDocs,
    signal: options.signal,
  };

  let index = 0;
  const workers = Array.from({ length: Math.min(limit, analyzersToRun.length) }, async () => {
    while (index < analyzersToRun.length) {
      if (options.signal?.aborted) break;
      const currentIndex = index++;
      const analyzer = analyzersToRun[currentIndex];

      try {
        const { result: analyzerResults, durationMs } = await measureDuration(
          () => analyzer.analyze(context),
        );

        if (options.withStats) {
          stats.push({ analyzer: analyzer.name, durationMs });
        }

        results.push(...analyzerResults);
      } catch (err: any) {
        errors.push(`Analyzer ${analyzer.name} failed: ${err?.message || String(err)}`);
      }
    }
  });

  await Promise.all(workers);

  const problems = results.reduce((acc, curr) => acc + curr.errors.length, 0);

  const output: AnalysisOutput = {
    errors,
    status: problems > 0 ? 'ProblemDetected' : 'OK',
    problems,
    results,
    ...(options.withStats ? { stats } : {}),
  };

  tryAttachProvider(output);

  return output;
}

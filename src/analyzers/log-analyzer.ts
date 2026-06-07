import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listPods, readPodLog } from '../kubernetes/resources';

/** Error patterns to search for in container logs. */
const ERROR_PATTERNS = [
  /\bERROR\b/i,
  /\bFATAL\b/i,
  /\bPANIC\b/i,
  /\bOOMKilled\b/i,
  /\bException\b/,
  /\bSegmentation fault\b/i,
];

/**
 * Checks if a single log line matches any known error patterns.
 * @param line The log line to check.
 * @returns True if the line contains an error pattern.
 */
const isErrorLine = (line: string): boolean =>
  ERROR_PATTERNS.some((pattern) => pattern.test(line));

/**
 * Scans log text for error pattern matches, returning the first few matches as failures.
 * @param logText Raw log output.
 * @param containerName Container name for context.
 * @returns Array of failures found.
 */
const scanLogForErrors = (logText: string, containerName: string): Failure[] => {
  const lines = logText.split('\n').filter(isErrorLine);
  if (lines.length === 0) return [];
  const sample = lines.slice(0, 3);
  return sample.map((line) => ({
    text: `Container ${containerName} log error: ${line.trim().slice(0, 200)}`,
  }));
};

/**
 * Analyzes logs for a single container.
 * @param podName Name of the pod.
 * @param namespace Namespace of the pod.
 * @param containerName Name of the container.
 * @param context Analyzer context options.
 * @returns Array of failures found.
 */
const analyzeContainerLogs = async (
  podName: string,
  namespace: string,
  containerName: string,
  context: AnalyzerContext,
): Promise<Failure[]> => {
  const log = await readPodLog(podName, namespace, containerName, context);
  return scanLogForErrors(log, containerName);
};

/**
 * Analyzes logs for a single pod.
 * @param pod The pod object to check.
 * @param context Analyzer context options.
 * @returns Array of failures found across all containers.
 */
const analyzePodLogs = async (
  pod: k8s.V1Pod,
  context: AnalyzerContext,
): Promise<Failure[]> => {
  const allErrors: Failure[] = [];
  const podName = pod.metadata?.name ?? '';
  const namespace = pod.metadata?.namespace ?? 'default';
  for (const container of pod.spec?.containers ?? []) {
    const errors = await analyzeContainerLogs(podName, namespace, container.name, context);
    allErrors.push(...errors);
  }
  return allErrors;
};

/**
 * Checks if a pod is in a non-healthy state.
 * @param pod The pod object to check.
 * @returns True if the pod has failed or has not-ready containers.
 */
const isPodUnhealthy = (pod: k8s.V1Pod): boolean =>
  pod.status?.phase === 'Failed' ||
  (pod.status?.containerStatuses?.some((cs) => !cs.ready) ?? false);

/**
 * Builds the AnalyzerResult object for a pod with error logs.
 * @param pod The pod object.
 * @param errors List of container log errors.
 * @returns Formatted AnalyzerResult.
 */
const buildLogAnalyzerResult = (pod: k8s.V1Pod, errors: Failure[]): AnalyzerResult => ({
  kind: 'Log',
  name: pod.metadata?.name ?? 'unknown-pod',
  namespace: pod.metadata?.namespace ?? 'default',
  errors,
});

/**
 * Analyzer implementation that scans Pod container logs for error patterns.
 * Only analyzes pods that are in a non-healthy state.
 */
export const LogAnalyzer: Analyzer = {
  name: 'Logs',
  /**
   * Scans container logs of unhealthy pods.
   * @param context Analyzer context options.
   * @returns Array of log analyzer results.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const pods = await listPods(context);
    const results: AnalyzerResult[] = [];

    for (const pod of pods) {
      if (!isPodUnhealthy(pod)) continue;

      const allErrors = await analyzePodLogs(pod, context);
      if (allErrors.length > 0) {
        results.push(buildLogAnalyzerResult(pod, allErrors));
      }
    }
    return results;
  },
};

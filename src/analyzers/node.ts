import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listNodes } from '../kubernetes/resources';

const PRESSURE_CONDITIONS = new Set(['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']);

/**
 * Resolves the name of the Node, defaulting to 'unknown-node' if missing.
 * @param node The Node object.
 */
const nodeName = (node: k8s.V1Node) => node.metadata?.name ?? 'unknown-node';

/**
 * Checks if the Node's Ready condition is True, reporting a failure if not.
 * @param node The Node object.
 * @returns Failure detail or null.
 */
const checkNodeReady = (node: k8s.V1Node): Failure | null => {
  const ready = node.status?.conditions?.find((condition) => condition.type === 'Ready');
  if (ready?.status !== 'True') {
    return {
      text: `Node is not Ready${ready?.reason ? `: ${ready.reason}` : ''}${ready?.message ? ` - ${ready.message}` : ''}`,
    };
  }
  return null;
};

/**
 * Gathers failures based on Node conditions indicating high resource pressure or offline network.
 * @param node The Node object.
 * @returns Array of pressure failures.
 */
const getPressureFailures = (node: k8s.V1Node): Failure[] => {
  const failures: Failure[] = [];
  for (const condition of node.status?.conditions ?? []) {
    if (PRESSURE_CONDITIONS.has(condition.type) && condition.status === 'True') {
      failures.push({
        text: `Node condition ${condition.type} is True${condition.message ? `: ${condition.message}` : ''}`,
      });
    }
  }
  return failures;
};

/**
 * Checks if the Node is spec-marked as unschedulable.
 * @param node The Node object.
 * @returns Failure detail or null.
 */
const getUnschedulableFailure = (node: k8s.V1Node): Failure | null => {
  if (node.spec?.unschedulable) {
    return { text: 'Node is marked unschedulable' };
  }
  return null;
};

/**
 * Aggregates all Node related validation failures: readiness, pressure, unschedulable.
 * @param node The Node object.
 * @returns Array of aggregated failures.
 */
const getNodeFailures = (node: k8s.V1Node): Failure[] => {
  const failures: Failure[] = [];
  const readyFailure = checkNodeReady(node);
  if (readyFailure) failures.push(readyFailure);
  failures.push(...getPressureFailures(node));
  const unschedulable = getUnschedulableFailure(node);
  if (unschedulable) failures.push(unschedulable);
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes Nodes.
 */
export const NodeAnalyzer: Analyzer = {
  name: 'Node',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const nodes = await listNodes(context);
    return nodes.flatMap((node) => {
      const errors = getNodeFailures(node);
      if (!errors.length) return [];
      return [{
        kind: 'Node',
        name: nodeName(node),
        errors,
      }];
    });
  },
};

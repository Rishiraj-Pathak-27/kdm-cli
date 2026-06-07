import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listNodes } from '../kubernetes/resources';

const PRESSURE_CONDITIONS = new Set(['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']);

const nodeName = (node: k8s.V1Node) => node.metadata?.name ?? 'unknown-node';

const getNodeFailures = (node: k8s.V1Node): Failure[] => {
  const failures: Failure[] = [];
  const ready = node.status?.conditions?.find((condition) => condition.type === 'Ready');

  if (ready?.status !== 'True') {
    failures.push({
      text: `Node is not Ready${ready?.reason ? `: ${ready.reason}` : ''}${ready?.message ? ` - ${ready.message}` : ''}`,
    });
  }

  for (const condition of node.status?.conditions ?? []) {
    if (PRESSURE_CONDITIONS.has(condition.type) && condition.status === 'True') {
      failures.push({
        text: `Node condition ${condition.type} is True${condition.message ? `: ${condition.message}` : ''}`,
      });
    }
  }

  if (node.spec?.unschedulable) {
    failures.push({ text: 'Node is marked unschedulable' });
  }

  return failures;
};

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


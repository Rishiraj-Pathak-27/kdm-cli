import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listPods } from '../kubernetes/resources';

const RESTART_WARNING_THRESHOLD = 3;
const WAITING_FAILURE_REASONS = new Set([
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
]);

const podName = (pod: k8s.V1Pod) => pod.metadata?.name ?? 'unknown-pod';
const podNamespace = (pod: k8s.V1Pod) => pod.metadata?.namespace ?? 'default';

const getPodFailures = (pod: k8s.V1Pod): Failure[] => {
  const failures: Failure[] = [];
  const phase = pod.status?.phase;

  if (phase === 'Failed') {
    failures.push({ text: `Pod phase is Failed${pod.status?.reason ? `: ${pod.status.reason}` : ''}` });
  }

  if (phase === 'Pending') {
    const scheduled = pod.status?.conditions?.find((condition) => condition.type === 'PodScheduled');
    if (scheduled?.status === 'False') {
      failures.push({
        text: `Pod is pending and unschedulable${scheduled.reason ? `: ${scheduled.reason}` : ''}${scheduled.message ? ` - ${scheduled.message}` : ''}`,
      });
    }
  }

  for (const status of pod.status?.containerStatuses ?? []) {
    const waiting = status.state?.waiting;
    if (waiting?.reason && WAITING_FAILURE_REASONS.has(waiting.reason)) {
      failures.push({
        text: `Container ${status.name} is waiting in ${waiting.reason}${waiting.message ? `: ${waiting.message}` : ''}`,
      });
    }

    if (!status.ready) {
      failures.push({ text: `Container ${status.name} is not ready` });
    }

    if ((status.restartCount ?? 0) > RESTART_WARNING_THRESHOLD) {
      failures.push({ text: `Container ${status.name} restarted ${status.restartCount} times` });
    }
  }

  return failures;
};

export const PodAnalyzer: Analyzer = {
  name: 'Pod',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const pods = await listPods(context);
    return pods.flatMap((pod) => {
      const errors = getPodFailures(pod);
      if (!errors.length) return [];
      return [{
        kind: 'Pod',
        name: podName(pod),
        namespace: podNamespace(pod),
        errors,
      }];
    });
  },
};


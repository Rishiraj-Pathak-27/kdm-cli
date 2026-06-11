import { getK8sApi } from './client';
import type * as k8s from '@kubernetes/client-node';
import { triggerAlert } from '../monitor/alerts';
import { logger } from '../utils/logger';

export interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  node: string;
}

export const getRunningPods = async (options?: { forceAlert?: boolean }): Promise<PodData[]> => {
  const api = getK8sApi();
  try {
    const res = await api.listPodForAllNamespaces();
    return (res.items ?? []).map((pod: k8s.V1Pod) => {
      const name = pod.metadata?.name || 'Unknown';
      const phase = pod.status?.phase || 'Unknown';
      const containerStatuses = pod.status?.containerStatuses || [];
      const restarts = containerStatuses.reduce((acc: number, status: k8s.V1ContainerStatus) => acc + status.restartCount, 0);

      // Check for failures
      let failureReason = '';
      if (phase === 'Failed') {
        failureReason = 'Pod phase is FAILED';
      } else {
        for (const status of containerStatuses) {
          if (status.state?.waiting) {
            const reason = status.state.waiting.reason;
            if (reason === 'CrashLoopBackOff' || reason === 'ImagePullBackOff' || reason === 'CreateContainerConfigError') {
              failureReason = `Container ${status.name} is in ${reason}`;
              break;
            }
          }
        }
      }

      if (failureReason) {
        triggerAlert({
          id: `pod:${name}:failure`,
          type: 'pod',
          severity: 'critical',
          message: `Pod ${name} in namespace ${pod.metadata?.namespace} failed: ${failureReason}`,
        }, { force: options?.forceAlert });
      }

      return {
        name,
        namespace: pod.metadata?.namespace || 'default',
        status: phase,
        restarts,
        node: pod.spec?.nodeName || 'Unknown',
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch Kubernetes pods: ${errorMessage}`);
    throw error;
  }
};

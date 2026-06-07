import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listDeployments } from '../kubernetes/resources';

const deploymentName = (deployment: k8s.V1Deployment) => deployment.metadata?.name ?? 'unknown-deployment';
const deploymentNamespace = (deployment: k8s.V1Deployment) => deployment.metadata?.namespace ?? 'default';

const getDeploymentFailures = (deployment: k8s.V1Deployment): Failure[] => {
  const failures: Failure[] = [];
  const desired = deployment.spec?.replicas ?? 1;
  const available = deployment.status?.availableReplicas ?? 0;
  const unavailable = deployment.status?.unavailableReplicas ?? Math.max(desired - available, 0);

  if (desired > available) {
    failures.push({ text: `Deployment has ${available}/${desired} available replicas` });
  }

  if (unavailable > 0) {
    failures.push({ text: `Deployment has ${unavailable} unavailable replica${unavailable === 1 ? '' : 's'}` });
  }

  for (const condition of deployment.status?.conditions ?? []) {
    if (condition.type === 'Progressing' && condition.reason === 'ProgressDeadlineExceeded') {
      failures.push({
        text: `Deployment rollout exceeded progress deadline${condition.message ? `: ${condition.message}` : ''}`,
      });
    }
    if (condition.status === 'False' && condition.message) {
      failures.push({ text: `Deployment condition ${condition.type} is False: ${condition.message}` });
    }
  }

  return failures;
};

export const DeploymentAnalyzer: Analyzer = {
  name: 'Deployment',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const deployments = await listDeployments(context);
    return deployments.flatMap((deployment) => {
      const errors = getDeploymentFailures(deployment);
      if (!errors.length) return [];
      return [{
        kind: 'Deployment',
        name: deploymentName(deployment),
        namespace: deploymentNamespace(deployment),
        errors,
      }];
    });
  },
};


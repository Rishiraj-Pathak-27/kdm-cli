import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listPersistentVolumeClaims } from '../kubernetes/resources';

/**
 * Resolves the name of the PersistentVolumeClaim, defaulting to 'unknown-pvc' if missing.
 * @param pvc The PersistentVolumeClaim object.
 */
const pvcName = (pvc: k8s.V1PersistentVolumeClaim) => pvc.metadata?.name ?? 'unknown-pvc';

/**
 * Resolves the namespace of the PersistentVolumeClaim, defaulting to 'default' if missing.
 * @param pvc The PersistentVolumeClaim object.
 */
const pvcNamespace = (pvc: k8s.V1PersistentVolumeClaim) => pvc.metadata?.namespace ?? 'default';

/**
 * Validates issues related to a PVC in a Pending phase.
 * Checks for a missing storage class.
 * @param pvc The PersistentVolumeClaim object.
 * @returns Array of failures found.
 */
const checkPendingPhase = (pvc: k8s.V1PersistentVolumeClaim): Failure[] => {
  if (pvc.status?.phase !== 'Pending') return [];
  if (!pvc.spec?.storageClassName) {
    return [{ text: 'PersistentVolumeClaim is pending without a storage class' }];
  }
  return [{ text: 'PersistentVolumeClaim is Pending' }];
};

/**
 * Validates issues related to a PVC in a Lost phase.
 * @param pvc The PersistentVolumeClaim object.
 * @returns Array of failures found.
 */
const checkLostPhase = (pvc: k8s.V1PersistentVolumeClaim): Failure[] => {
  if (pvc.status?.phase === 'Lost') {
    return [{ text: 'PersistentVolumeClaim is Lost' }];
  }
  return [];
};

/**
 * Collects failure details from status conditions of the PVC.
 * @param pvc The PersistentVolumeClaim object.
 * @returns Array of failures found.
 */
const collectStatusConditions = (pvc: k8s.V1PersistentVolumeClaim): Failure[] => {
  const failures: Failure[] = [];
  for (const condition of pvc.status?.conditions ?? []) {
    if (condition.message) {
      failures.push({
        text: `PersistentVolumeClaim condition ${condition.type} is ${condition.status}${condition.reason ? ` (${condition.reason})` : ''}: ${condition.message}`,
      });
    }
  }
  return failures;
};

/**
 * Aggregates all PVC validation checks: pending, lost, and status conditions.
 * @param pvc The PersistentVolumeClaim object.
 * @returns Array of aggregated failures.
 */
const getPvcFailures = (pvc: k8s.V1PersistentVolumeClaim): Failure[] => [
  ...checkPendingPhase(pvc),
  ...checkLostPhase(pvc),
  ...collectStatusConditions(pvc),
];

/**
 * Analyzer implementation focused on Kubernetes PersistentVolumeClaims.
 */
export const PersistentVolumeClaimAnalyzer: Analyzer = {
  name: 'PersistentVolumeClaim',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const pvcs = await listPersistentVolumeClaims(context);
    return pvcs.flatMap((pvc) => {
      const errors = getPvcFailures(pvc);
      if (!errors.length) return [];
      return [{
        kind: 'PersistentVolumeClaim',
        name: pvcName(pvc),
        namespace: pvcNamespace(pvc),
        errors,
      }];
    });
  },
};

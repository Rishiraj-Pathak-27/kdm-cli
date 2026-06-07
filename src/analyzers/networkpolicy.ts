import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listNetworkPolicies } from '../kubernetes/resources';

/**
 * Verifies if matchLabels selector exists and is populated.
 * @param selector Label selector object.
 * @returns True if contains at least one match label.
 */
const hasMatchLabels = (selector: k8s.V1LabelSelector | undefined): boolean => {
  if (!selector?.matchLabels) return false;
  return Object.keys(selector.matchLabels).length > 0;
};

/**
 * Verifies if matchExpressions selector exists and is populated.
 * @param selector Label selector object.
 * @returns True if contains at least one match expression.
 */
const hasMatchExpressions = (selector: k8s.V1LabelSelector | undefined): boolean => {
  if (!selector?.matchExpressions) return false;
  return selector.matchExpressions.length > 0;
};

/**
 * Checks NetworkPolicy for empty or overly broad selectors.
 * @param np The NetworkPolicy object.
 * @returns Array of failures found.
 */
const checkNetworkPolicySelector = (np: k8s.V1NetworkPolicy): Failure[] => {
  const selector = np.spec?.podSelector;
  if (!hasMatchLabels(selector) && !hasMatchExpressions(selector)) {
    return [{ text: 'NetworkPolicy has an empty podSelector (applies to all pods in namespace)' }];
  }
  return [];
};

/**
 * Checks if ingress is blocked on the network policy.
 * @param np The NetworkPolicy object.
 * @param types Target policy types.
 * @returns True if ingress is declared but blocked.
 */
const isIngressBlocked = (np: k8s.V1NetworkPolicy, types: string[]): boolean =>
  types.includes('Ingress') && !np.spec?.ingress?.length;

/**
 * Checks if egress is blocked on the network policy.
 * @param np The NetworkPolicy object.
 * @param types Target policy types.
 * @returns True if egress is declared but blocked.
 */
const isEgressBlocked = (np: k8s.V1NetworkPolicy, types: string[]): boolean =>
  types.includes('Egress') && !np.spec?.egress?.length;

/**
 * Checks NetworkPolicy for missing ingress and egress rules.
 * @param np The NetworkPolicy object.
 * @returns Array of failures found.
 */
const checkNetworkPolicyRules = (np: k8s.V1NetworkPolicy): Failure[] => {
  const failures: Failure[] = [];
  const types = np.spec?.policyTypes ?? [];

  if (isIngressBlocked(np, types)) {
    failures.push({ text: 'NetworkPolicy declares Ingress policy type but has no ingress rules (blocks all ingress)' });
  }
  if (isEgressBlocked(np, types)) {
    failures.push({ text: 'NetworkPolicy declares Egress policy type but has no egress rules (blocks all egress)' });
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes NetworkPolicies.
 */
export const NetworkPolicyAnalyzer: Analyzer = {
  name: 'NetworkPolicy',
  /**
   * Performs analysis on NetworkPolicy resources to verify selectors and ingress/egress rules.
   * @param context Analyzer context options.
   * @returns Array of analyzer results highlighting any misconfigurations.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listNetworkPolicies(context);
    return resources.flatMap((np) => {
      const errors = [...checkNetworkPolicySelector(np), ...checkNetworkPolicyRules(np)];
      if (!errors.length) return [];
      return [{
        kind: 'NetworkPolicy',
        name: np.metadata?.name ?? 'unknown-networkpolicy',
        namespace: np.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};

import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { labelsToSelector, listPods, listServices, readEndpoints } from '../kubernetes/resources';

/**
 * Resolves the name of the Service, defaulting to 'unknown-service' if missing.
 * @param service The Service object.
 */
const serviceName = (service: k8s.V1Service) => service.metadata?.name ?? 'unknown-service';

/**
 * Resolves the namespace of the Service, defaulting to 'default' if missing.
 * @param service The Service object.
 */
const serviceNamespace = (service: k8s.V1Service) => service.metadata?.namespace ?? 'default';

/**
 * Helper to determine if an Endpoints resource contains any ready target addresses.
 * @param endpoints The Endpoints object or undefined.
 * @returns True if empty or no addresses are present, False otherwise.
 */
const endpointsAreEmpty = (endpoints?: k8s.V1Endpoints) =>
  !endpoints?.subsets?.some((subset) => (subset.addresses?.length ?? 0) > 0);

/**
 * Checks if a Service's selector matched any pods during listing.
 * @param matchingPods Pod list for the service selector.
 * @param selector The service selector filter string.
 * @returns Array of failures found.
 */
const checkSelectorMatch = (matchingPods: k8s.V1Pod[], selector: string): Failure[] => {
  if (!matchingPods.length) {
    return [{ text: `Service selector matches no pods (${selector})` }];
  }
  return [];
};

/**
 * Validates endpoints existence and readiness for the service.
 * @param endpoints Service endpoints.
 * @returns Array of failures found.
 */
const checkEndpoints = (endpoints: k8s.V1Endpoints | undefined): Failure[] => {
  if (endpointsAreEmpty(endpoints)) {
    return [{ text: 'Service has no ready endpoints' }];
  }
  return [];
};

/**
 * Helper to determine if a string port is resolved in matching pods.
 * @param targetPort The port name.
 * @param pods The list of matching pods.
 * @returns True if resolved, false otherwise.
 */
const isStringPortResolved = (targetPort: string, pods: k8s.V1Pod[]): boolean =>
  pods.some((pod) =>
    pod.spec?.containers?.some((container) =>
      container.ports?.some((cp) => cp.name === targetPort),
    ),
  );

/**
 * Helper to determine if a numeric port is resolved in matching pods.
 * @param targetPort The port number.
 * @param pods The list of matching pods.
 * @returns True if resolved, false otherwise.
 */
const isNumberPortResolved = (targetPort: number, pods: k8s.V1Pod[]): boolean =>
  pods.some((pod) =>
    pod.spec?.containers?.some((container) =>
      container.ports?.some((cp) => cp.containerPort === targetPort),
    ),
  );

/**
 * Checks if a Service string-based targetPort resolves to a named container port in pods.
 * @param targetPort The port name.
 * @param matchingPods Pods that match the service's selector.
 * @returns Array of failures found.
 */
const checkStringPort = (
  targetPort: string,
  matchingPods: k8s.V1Pod[],
): Failure[] => {
  if (!isStringPortResolved(targetPort, matchingPods)) {
    return [{
      text: `Service target port '${targetPort}' appears unresolved (no matching container port name found in pods)`,
    }];
  }
  return [];
};

/**
 * Checks if a Service numeric targetPort is declared and resolved in matching pods.
 * @param targetPort The port number.
 * @param matchingPods Pods that match the service's selector.
 * @returns Array of failures found.
 */
const checkNumericPort = (
  targetPort: number,
  matchingPods: k8s.V1Pod[],
): Failure[] => {
  const hasDeclaredPorts = matchingPods.some((pod) =>
    pod.spec?.containers?.some((container) => (container.ports?.length ?? 0) > 0),
  );
  if (hasDeclaredPorts && !isNumberPortResolved(targetPort, matchingPods)) {
    return [{
      text: `Service target port ${targetPort} appears unresolved (no matching containerPort found in pods)`,
    }];
  }
  return [];
};

/**
 * Validates a single Service port mapping.
 * @param port The Service port to validate.
 * @param matchingPods Pods that match the service's selector.
 * @returns Array of failures found.
 */
const checkSinglePort = (
  port: k8s.V1ServicePort,
  matchingPods: k8s.V1Pod[],
): Failure[] => {
  const targetPort = port.targetPort ?? port.port;

  if (typeof targetPort === 'string') {
    return checkStringPort(targetPort, matchingPods);
  } else if (typeof targetPort === 'number') {
    return checkNumericPort(targetPort, matchingPods);
  }

  return [];
};

/**
 * Checks if all ports declared by a Service can map to exposed ports of matching backend Pods.
 * Checks string port names and numeric port numbers.
 * @param service The Service object.
 * @param matchingPods Pods that match the service's selector.
 * @returns Array of targetPort validation failures.
 */
const checkTargetPorts = (
  service: k8s.V1Service,
  matchingPods: k8s.V1Pod[],
): Failure[] => {
  return (service.spec?.ports ?? []).flatMap((port) => checkSinglePort(port, matchingPods));
};

/**
 * Filters a list of pods in-memory to find those matching a key-value selector.
 * @param pods List of pods to filter.
 * @param selector Key-value selector map.
 * @returns Filtered pods matching the selector.
 */
const filterPodsBySelector = (pods: k8s.V1Pod[], selector: Record<string, string>): k8s.V1Pod[] => {
  const selectorEntries = Object.entries(selector);
  return pods.filter((pod) => {
    const labels = pod.metadata?.labels ?? {};
    return selectorEntries.every(([key, val]) => labels[key] === val);
  });
};

/**
 * Main validation routine evaluating selector matching, endpoints state, and target port maps for a Service.
 * @param service The Service object.
 * @param context Analyzer context mapping namespace and settings.
 * @param podsInNamespace Pre-cached list of Pods in the service namespace.
 * @returns Array of failures found.
 */
const getServiceFailures = async (
  service: k8s.V1Service,
  context: AnalyzerContext,
  podsInNamespace: k8s.V1Pod[],
): Promise<Failure[]> => {
  if (service.spec?.type === 'ExternalName') return [];

  const namespace = serviceNamespace(service);
  const name = serviceName(service);
  const failures: Failure[] = [];

  const selector = service.spec?.selector;
  const hasSelector = selector && Object.keys(selector).length > 0;
  let matchingPods: k8s.V1Pod[] = [];

  if (hasSelector) {
    const selectorStr = labelsToSelector(selector!);
    matchingPods = filterPodsBySelector(podsInNamespace, selector!);
    failures.push(...checkSelectorMatch(matchingPods, selectorStr));
  }

  const endpoints = await readEndpoints(name, namespace, context);
  failures.push(...checkEndpoints(endpoints));

  if (hasSelector && matchingPods.length > 0) {
    failures.push(...checkTargetPorts(service, matchingPods));
  }

  return failures;
};

/**
 * Groups pods by their namespace for faster lookup.
 * @param pods List of pods.
 * @returns Map of namespace to pods list.
 */
const groupPodsByNamespace = (pods: k8s.V1Pod[]): Map<string, k8s.V1Pod[]> => {
  const podsByNamespace = new Map<string, k8s.V1Pod[]>();
  for (const pod of pods) {
    const ns = pod.metadata?.namespace ?? 'default';
    let list = podsByNamespace.get(ns);
    if (!list) {
      list = [];
      podsByNamespace.set(ns, list);
    }
    list.push(pod);
  }
  return podsByNamespace;
};

/**
 * Processes Promise.allSettled results to build AnalyzerResults.
 * @param settled Settled analysis promises.
 * @returns Aggregated AnalyzerResults list.
 */
const processSettledResults = (
  settled: PromiseSettledResult<AnalyzerResult | null>[],
): AnalyzerResult[] => {
  const results: AnalyzerResult[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      if (result.value !== null) {
        results.push(result.value);
      }
    } else {
      results.push({
        kind: 'Service',
        name: 'unknown-service',
        errors: [{ text: `Service analysis failed: ${result.reason?.message || String(result.reason)}` }],
      });
    }
  }
  return results;
};

/**
 * Analyzer implementation focused on Kubernetes Services.
 */
export const ServiceAnalyzer: Analyzer = {
  name: 'Service',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const services = await listServices(context);
    const allPods = await listPods({
      kubeconfig: context.kubeconfig,
      kubecontext: context.kubecontext,
      namespace: context.namespace,
      signal: context.signal,
    });

    const podsByNamespace = groupPodsByNamespace(allPods);

    const settled = await Promise.allSettled(
      services.map(async (service) => {
        const ns = serviceNamespace(service);
        const podsInNamespace = podsByNamespace.get(ns) ?? [];
        const errors = await getServiceFailures(service, context, podsInNamespace);
        if (!errors.length) return null;
        return {
          kind: 'Service' as const,
          name: serviceName(service),
          namespace: ns,
          errors,
        };
      }),
    );

    return processSettledResults(settled);
  },
};

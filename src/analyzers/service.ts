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
  const failures: Failure[] = [];
  const ports = service.spec?.ports ?? [];

  for (const port of ports) {
    const targetPort = port.targetPort ?? port.port;

    if (typeof targetPort === 'string') {
      const resolved = matchingPods.some((pod) =>
        pod.spec?.containers?.some((container) =>
          container.ports?.some((cp) => cp.name === targetPort),
        ),
      );
      if (!resolved) {
        failures.push({
          text: `Service target port '${targetPort}' appears unresolved (no matching container port name found in pods)`,
        });
      }
    } else if (typeof targetPort === 'number') {
      const hasDeclaredPorts = matchingPods.some((pod) =>
        pod.spec?.containers?.some((container) => (container.ports?.length ?? 0) > 0),
      );
      if (hasDeclaredPorts) {
        const resolved = matchingPods.some((pod) =>
          pod.spec?.containers?.some((container) =>
            container.ports?.some((cp) => cp.containerPort === targetPort),
          ),
        );
        if (!resolved) {
          failures.push({
            text: `Service target port ${targetPort} appears unresolved (no matching containerPort found in pods)`,
          });
        }
      }
    }
  }

  return failures;
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
  let matchingPods: k8s.V1Pod[] = [];
  if (selector && Object.keys(selector).length > 0) {
    const selectorStr = labelsToSelector(selector);
    const selectorEntries = Object.entries(selector);
    matchingPods = podsInNamespace.filter((pod) => {
      const labels = pod.metadata?.labels ?? {};
      return selectorEntries.every(([key, val]) => labels[key] === val);
    });
    failures.push(...checkSelectorMatch(matchingPods, selectorStr));
  }

  const endpoints = await readEndpoints(name, namespace, context);
  failures.push(...checkEndpoints(endpoints));

  if (selector && Object.keys(selector).length > 0 && matchingPods.length > 0) {
    failures.push(...checkTargetPorts(service, matchingPods));
  }

  return failures;
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

    const podsByNamespace = new Map<string, k8s.V1Pod[]>();
    for (const pod of allPods) {
      const ns = pod.metadata?.namespace ?? 'default';
      if (!podsByNamespace.has(ns)) {
        podsByNamespace.set(ns, []);
      }
      podsByNamespace.get(ns)!.push(pod);
    }

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

    const results: AnalyzerResult[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        results.push({
          kind: 'Service',
          name: 'unknown-service',
          errors: [{ text: `Service analysis failed: ${result.reason?.message || String(result.reason)}` }],
        });
      }
    }
    return results;
  },
};

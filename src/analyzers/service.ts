import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { labelsToSelector, listPods, listServices, readEndpoints } from '../kubernetes/resources';

const serviceName = (service: k8s.V1Service) => service.metadata?.name ?? 'unknown-service';
const serviceNamespace = (service: k8s.V1Service) => service.metadata?.namespace ?? 'default';

const endpointsAreEmpty = (endpoints?: k8s.V1Endpoints) =>
  !endpoints?.subsets?.some((subset) => (subset.addresses?.length ?? 0) > 0);

const getServiceFailures = async (
  service: k8s.V1Service,
  context: AnalyzerContext,
): Promise<Failure[]> => {
  const failures: Failure[] = [];
  const namespace = serviceNamespace(service);
  const name = serviceName(service);

  if (service.spec?.type === 'ExternalName') {
    return failures;
  }

  const selector = labelsToSelector(service.spec?.selector);
  let matchingPods: k8s.V1Pod[] = [];
  if (selector) {
    matchingPods = await listPods({ ...context, namespace, labelSelector: selector });
    if (!matchingPods.length) {
      failures.push({ text: `Service selector matches no pods (${selector})` });
    }
  }

  const endpoints = await readEndpoints(name, namespace, context);
  if (endpointsAreEmpty(endpoints)) {
    failures.push({ text: 'Service has no ready endpoints' });
  }

  if (selector && matchingPods.length > 0) {
    const ports = service.spec?.ports ?? [];
    for (const port of ports) {
      const targetPort = port.targetPort ?? port.port;
      let resolved = false;

      if (typeof targetPort === 'string') {
        resolved = matchingPods.some((pod) =>
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
          resolved = matchingPods.some((pod) =>
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
  }

  return failures;
};

export const ServiceAnalyzer: Analyzer = {
  name: 'Service',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const services = await listServices(context);
    const results: AnalyzerResult[] = [];

    for (const service of services) {
      const errors = await getServiceFailures(service, context);
      if (errors.length) {
        results.push({
          kind: 'Service',
          name: serviceName(service),
          namespace: serviceNamespace(service),
          errors,
        });
      }
    }

    return results;
  },
};


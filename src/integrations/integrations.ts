import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from '../analyzers/types';
import { registry } from '../analyzers';
import { getCustomObjectsApi } from '../kubernetes/client';

/** Configuration for an integration. */
export interface IntegrationConfig {
  name: string;
  enabled: boolean;
}

/**
 * Integration registry that manages third-party integrations
 * and registers their analyzers into the main analyzer registry.
 */
export class IntegrationRegistry {
  private integrations = new Map<string, Analyzer>();

  /**
   * Registers an integration analyzer and adds it to the main registry.
   * @param analyzer The integration analyzer to register.
   */
  register(analyzer: Analyzer): void {
    this.integrations.set(analyzer.name, analyzer);
    registry.register(analyzer);
  }

  /**
   * Lists all registered integration analyzers.
   * @returns Array of integration analyzer instances.
   */
  list(): Analyzer[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Checks if an integration is registered.
   * @param name Integration analyzer name.
   * @returns True if the integration exists.
   */
  has(name: string): boolean {
    return this.integrations.has(name);
  }
}

export const integrationRegistry = new IntegrationRegistry();

/**
 * Checks KEDA ScaledObject conditions for readiness.
 * @param resource KEDA ScaledObject custom resource.
 * @returns Array of failures found.
 */
const checkKEDAScaledObject = (resource: any): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of resource.status?.conditions ?? []) {
    if (cond.type === 'Ready' && cond.status !== 'True') {
      failures.push({ text: `KEDA ScaledObject not ready${cond.message ? `: ${cond.message}` : ''}` });
    }
  }
  return failures;
};

interface CustomObjectParams {
  group: string;
  version: string;
  plural: string;
  kind: string;
  context: AnalyzerContext;
  checkFn: (resource: any) => Failure[];
  hasNamespace?: boolean;
}

/**
 * Fetches custom objects from the cluster using namespaced or cluster API.
 */
const fetchCustomObjects = async (api: any, params: CustomObjectParams) => {
  const useNamespace = params.context.namespace && params.hasNamespace !== false;
  if (useNamespace) {
    return api.listNamespacedCustomObject({
      group: params.group,
      version: params.version,
      namespace: params.context.namespace,
      plural: params.plural,
    });
  }
  return api.listClusterCustomObject({
    group: params.group,
    version: params.version,
    plural: params.plural,
  });
};

/**
 * Maps a single custom object to an analyzer result array.
 */
const mapCustomObjectToResult = (
  resource: any,
  params: CustomObjectParams,
): AnalyzerResult[] => {
  const errors = params.checkFn(resource);
  if (!errors.length) return [];

  const result: AnalyzerResult = {
    kind: params.kind,
    name: resource.metadata?.name ?? 'unknown',
    errors,
  };

  const useNamespace = params.context.namespace && params.hasNamespace !== false;
  const namespace = resource.metadata?.namespace ?? (useNamespace ? params.context.namespace : undefined);
  if (namespace) {
    result.namespace = namespace;
  }

  return [result];
};

/**
 * Helper to fetch and analyze custom objects.
 * @param params Configuration parameters.
 * @returns Array of analyzer results.
 */
async function analyzeCustomObjects(params: CustomObjectParams): Promise<AnalyzerResult[]> {
  try {
    const api = getCustomObjectsApi(params.context);
    const response = await fetchCustomObjects(api, params);
    const items = (response as any)?.items ?? [];
    return items.flatMap((resource: any) => mapCustomObjectToResult(resource, params));
  } catch {
    return [];
  }
}

interface CustomObjectAnalyzerConfig {
  group: string;
  version: string;
  plural: string;
  kind: string;
  checkFn: (resource: any) => Failure[];
  hasNamespace?: boolean;
}

/**
 * Creates a standard custom object analyzer.
 */
const createCustomObjectAnalyzer = (config: CustomObjectAnalyzerConfig): Analyzer => ({
  name: config.kind,
  /**
   * Performs analysis on custom resources.
   * @param context Analyzer context options.
   * @returns Array of analyzer results.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    return analyzeCustomObjects({ ...config, context });
  },
});

/**
 * KEDA integration analyzer checking ScaledObject health.
 */
export const KEDAAnalyzer = createCustomObjectAnalyzer({
  group: 'keda.sh',
  version: 'v1alpha1',
  plural: 'scaledobjects',
  kind: 'KEDA',
  checkFn: checkKEDAScaledObject,
});

/**
 * Checks Kyverno ClusterPolicy compliance status.
 * @param resource Kyverno ClusterPolicy custom resource.
 * @returns Array of failures found.
 */
const checkKyvernoPolicy = (resource: any): Failure[] => {
  const failures: Failure[] = [];
  if (resource.status?.ready === false) {
    failures.push({ text: `Kyverno policy not ready` });
  }
  for (const cond of resource.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `Kyverno policy ${cond.type}: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Kyverno integration analyzer checking ClusterPolicy compliance.
 */
export const KyvernoAnalyzer = createCustomObjectAnalyzer({
  group: 'kyverno.io',
  version: 'v1',
  plural: 'clusterpolicies',
  kind: 'Kyverno',
  checkFn: checkKyvernoPolicy,
  hasNamespace: false,
});

/**
 * Checks Prometheus ServiceMonitor configuration.
 * @param resource Prometheus ServiceMonitor custom resource.
 * @returns Array of failures found.
 */
const checkPrometheusServiceMonitor = (resource: any): Failure[] => {
  if (!resource.spec?.endpoints?.length) {
    return [{ text: 'ServiceMonitor has no endpoints configured' }];
  }
  return [];
};

/**
 * Prometheus integration analyzer checking ServiceMonitor configuration.
 */
export const PrometheusAnalyzer = createCustomObjectAnalyzer({
  group: 'monitoring.coreos.com',
  version: 'v1',
  plural: 'servicemonitors',
  kind: 'Prometheus',
  checkFn: checkPrometheusServiceMonitor,
});

/**
 * Registers all available integration analyzers.
 * Called during application initialization.
 */
export function registerIntegrations(): void {
  integrationRegistry.register(KEDAAnalyzer);
  integrationRegistry.register(KyvernoAnalyzer);
  integrationRegistry.register(PrometheusAnalyzer);
}

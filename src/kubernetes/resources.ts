import type * as k8s from '@kubernetes/client-node';
import { getAppsApi, getK8sApi, type KubernetesClientOptions } from './client';

export interface KubernetesResourceOptions extends KubernetesClientOptions {
  namespace?: string;
  labelSelector?: string;
}

type K8sList<T> = { items?: T[] };
type K8sResponse<T> = T | { body: T };

/**
 * Unwraps the K8s API response body if it's wrapped in a response container object.
 * @param response K8s response container.
 * @returns Unwrapped payload object.
 */
const unwrap = <T>(response: K8sResponse<T>): T =>
  response && typeof response === 'object' && 'body' in response
    ? (response as { body: T }).body
    : (response as T);

/**
 * Extracts items list from a K8s response representing a collection of objects.
 * @param response K8s list response container.
 * @returns Array of resources.
 */
const items = <T>(response: K8sResponse<K8sList<T>>): T[] => unwrap(response).items ?? [];

/**
 * Checks if the caught error matches a 404 NotFound HTTP status code.
 * @param error Caught exception object.
 * @returns True if code is 404, False otherwise.
 */
const isNotFoundError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const statusCode = (error as any).statusCode ?? (error as any).response?.statusCode ?? (error as any).code;
    return statusCode === 404;
  }
  return false;
};

/**
 * Queries the cluster to retrieve a list of Pods matching filters and namespace.
 * @param options Target namespace, client configs, and selectors.
 * @returns List of Pod resources.
 */
export const listPods = async (options: KubernetesResourceOptions = {}): Promise<k8s.V1Pod[]> => {
  const api = getK8sApi(options);
  const response = options.namespace
    ? await api.listNamespacedPod(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listPodForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Pod>(response);
};

/**
 * Queries the cluster to retrieve a list of Deployments matching filters and namespace.
 * @param options Target namespace, client configs, and selectors.
 * @returns List of Deployment resources.
 */
export const listDeployments = async (
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Deployment[]> => {
  const api = getAppsApi(options);
  const response = options.namespace
    ? await api.listNamespacedDeployment(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listDeploymentForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Deployment>(response);
};

/**
 * Queries the cluster to retrieve a list of Services matching filters and namespace.
 * @param options Target namespace, client configs, and selectors.
 * @returns List of Service resources.
 */
export const listServices = async (
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Service[]> => {
  const api = getK8sApi(options);
  const response = options.namespace
    ? await api.listNamespacedService(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listServiceForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Service>(response);
};

/**
 * Queries the cluster to retrieve a list of PersistentVolumeClaims matching filters and namespace.
 * @param options Target namespace, client configs, and selectors.
 * @returns List of PVC resources.
 */
export const listPersistentVolumeClaims = async (
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1PersistentVolumeClaim[]> => {
  const api = getK8sApi(options);
  const response = options.namespace
    ? await api.listNamespacedPersistentVolumeClaim(
        options.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        options.labelSelector,
      )
    : await api.listPersistentVolumeClaimForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1PersistentVolumeClaim>(response);
};

/**
 * Queries the cluster to retrieve a list of Nodes matching filters.
 * @param options Client configs and selectors.
 * @returns List of Node resources.
 */
export const listNodes = async (options: KubernetesResourceOptions = {}): Promise<k8s.V1Node[]> => {
  const api = getK8sApi(options);
  const response = await api.listNode(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Node>(response);
};

/**
 * Reads detailed Endpoint mapping configurations for a specific Service.
 * Suppresses NotFound (404) errors by returning undefined.
 * @param name Service name.
 * @param namespace Namespace name.
 * @param options Client config settings.
 * @returns Endpoints detail or undefined.
 */
export const readEndpoints = async (
  name: string,
  namespace: string,
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Endpoints | undefined> => {
  const api = getK8sApi(options);
  try {
    return unwrap(await api.readNamespacedEndpoints(name, namespace));
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
};

/**
 * Converts a simple key-value label map into a standard labelSelector string.
 * @param labels Key-value map.
 * @returns Formatted labelSelector selector.
 */
export const labelsToSelector = (labels: Record<string, string> = {}) =>
  Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

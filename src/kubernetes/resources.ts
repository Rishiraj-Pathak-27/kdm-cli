import type * as k8s from '@kubernetes/client-node';
import { getAppsApi, getK8sApi, type KubernetesClientOptions } from './client';

export interface KubernetesResourceOptions extends KubernetesClientOptions {
  namespace?: string;
  labelSelector?: string;
}

type K8sList<T> = { items?: T[] };
type K8sResponse<T> = T | { body: T };

const unwrap = <T>(response: K8sResponse<T>): T =>
  response && typeof response === 'object' && 'body' in response
    ? (response as { body: T }).body
    : (response as T);

const items = <T>(response: K8sResponse<K8sList<T>>): T[] => unwrap(response).items ?? [];

export const listPods = async (options: KubernetesResourceOptions = {}): Promise<k8s.V1Pod[]> => {
  const api = getK8sApi(options);
  const response = options.namespace
    ? await api.listNamespacedPod(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listPodForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Pod>(response);
};

export const listDeployments = async (
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Deployment[]> => {
  const api = getAppsApi(options);
  const response = options.namespace
    ? await api.listNamespacedDeployment(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listDeploymentForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Deployment>(response);
};

export const listServices = async (
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Service[]> => {
  const api = getK8sApi(options);
  const response = options.namespace
    ? await api.listNamespacedService(options.namespace, undefined, undefined, undefined, undefined, options.labelSelector)
    : await api.listServiceForAllNamespaces(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Service>(response);
};

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

export const listNodes = async (options: KubernetesResourceOptions = {}): Promise<k8s.V1Node[]> => {
  const api = getK8sApi(options);
  const response = await api.listNode(undefined, undefined, undefined, options.labelSelector);
  return items<k8s.V1Node>(response);
};

export const readEndpoints = async (
  name: string,
  namespace: string,
  options: KubernetesResourceOptions = {},
): Promise<k8s.V1Endpoints | undefined> => {
  const api = getK8sApi(options);
  try {
    return unwrap(await api.readNamespacedEndpoints(name, namespace));
  } catch {
    return undefined;
  }
};

export const labelsToSelector = (labels: Record<string, string> = {}) =>
  Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

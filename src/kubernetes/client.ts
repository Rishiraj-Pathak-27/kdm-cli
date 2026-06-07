import * as k8s from '@kubernetes/client-node';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../utils/logger';

let kc: k8s.KubeConfig | null = null;
let k8sApi: k8s.CoreV1Api | null = null;
let appsApi: k8s.AppsV1Api | null = null;
let clientKey = '';

export interface KubernetesClientOptions {
  kubeconfig?: string;
  kubecontext?: string;
}

const getClientKey = (options: KubernetesClientOptions = {}) =>
  `${options.kubeconfig ?? 'default'}::${options.kubecontext ?? 'current'}`;

/**
 * Asserts that a specified kubeconfig path points to an actual existing file on the disk.
 * @param filePath The resolved file path.
 * @throws Error if path is not a file or does not exist.
 */
const validateKubeconfigPath = (filePath: string): void => {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`Kubeconfig path is not a file: ${resolved}`);
  }
};

/**
 * Loads, configures, and caches a KubeConfig instance based on the provided overrides.
 * @param options Options containing custom config file paths or context names.
 * @returns Cached KubeConfig instance.
 */
export const getKubeConfig = (options: KubernetesClientOptions = {}): k8s.KubeConfig => {
  const nextKey = getClientKey(options);
  if (!kc || clientKey !== nextKey) {
    kc = new k8s.KubeConfig();
    try {
      if (options.kubeconfig) {
        validateKubeconfigPath(options.kubeconfig);
        kc.loadFromFile(options.kubeconfig);
      } else {
        kc.loadFromDefault();
      }
      if (options.kubecontext) {
        kc.setCurrentContext(options.kubecontext);
      }
    } catch (e: any) {
      throw new Error(`Failed to load kubeconfig: ${e?.message || String(e)}`);
    }
    clientKey = nextKey;
    k8sApi = null;
    appsApi = null;
  }
  return kc;
};

/**
 * Resolves a configured instance of the CoreV1Api client.
 * @param options Options configuration.
 * @returns CoreV1Api client.
 */
export const getK8sApi = (options: KubernetesClientOptions = {}): k8s.CoreV1Api => {
  if (!k8sApi) {
    const config = getKubeConfig(options);
    k8sApi = config.makeApiClient(k8s.CoreV1Api);
  }
  return k8sApi;
};

/**
 * Resolves a configured instance of the AppsV1Api client.
 * @param options Options configuration.
 * @returns AppsV1Api client.
 */
export const getAppsApi = (options: KubernetesClientOptions = {}): k8s.AppsV1Api => {
  if (!appsApi) {
    const config = getKubeConfig(options);
    appsApi = config.makeApiClient(k8s.AppsV1Api);
  }
  return appsApi;
};

export const checkK8sConnection = async (): Promise<{ connected: boolean; podCount: number }> => {
  try {
    const api = getK8sApi();
    const res = await api.listPodForAllNamespaces();
    const runningPods = res.body.items.filter(pod => pod.status?.phase === 'Running');
    return {
      connected: true,
      podCount: runningPods.length,
    };
  } catch (error) {
    return {
      connected: false,
      podCount: 0,
    };
  }
};

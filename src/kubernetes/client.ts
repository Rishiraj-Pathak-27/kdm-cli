import * as k8s from '@kubernetes/client-node';

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

export const getKubeConfig = (options: KubernetesClientOptions = {}): k8s.KubeConfig => {
  const nextKey = getClientKey(options);
  if (!kc || clientKey !== nextKey) {
    kc = new k8s.KubeConfig();
    try {
      if (options.kubeconfig) {
        kc.loadFromFile(options.kubeconfig);
      } else {
        kc.loadFromDefault();
      }
      if (options.kubecontext) {
        kc.setCurrentContext(options.kubecontext);
      }
    } catch (e) {
      // Failed to load default config
    }
    clientKey = nextKey;
    k8sApi = null;
    appsApi = null;
  }
  return kc;
};

export const getK8sApi = (options: KubernetesClientOptions = {}): k8s.CoreV1Api => {
  if (!k8sApi) {
    const config = getKubeConfig(options);
    k8sApi = config.makeApiClient(k8s.CoreV1Api);
  }
  return k8sApi;
};

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

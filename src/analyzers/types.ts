export interface Analyzer {
  name: string;
  analyze(context: AnalyzerContext): Promise<AnalyzerResult[]>;
}

export interface AnalyzerContext {
  namespace?: string;
  labelSelector?: string;
  kubeconfig?: string;
  kubecontext?: string;
  withDocs?: boolean;
}

export interface AnalyzerResult {
  kind: string;
  name: string;
  namespace?: string;
  parentObject?: string;
  errors: Failure[];
  details?: string;
}

export interface Failure {
  text: string;
  kubernetesDoc?: string;
  sensitive?: SensitiveValue[];
}

export interface SensitiveValue {
  unmasked: string;
  masked: string;
}

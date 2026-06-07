import { Analyzer } from './types';
import { PodAnalyzer } from './pod';
import { DeploymentAnalyzer } from './deployment';
import { ServiceAnalyzer } from './service';
import { PersistentVolumeClaimAnalyzer } from './pvc';
import { NodeAnalyzer } from './node';

class AnalyzerRegistry {
  private analyzers = new Map<string, Analyzer>();

  register(analyzer: Analyzer): void {
    this.analyzers.set(analyzer.name, analyzer);
  }

  get(name: string): Analyzer | undefined {
    return this.analyzers.get(name);
  }

  list(): Analyzer[] {
    return Array.from(this.analyzers.values());
  }

  has(name: string): boolean {
    return this.analyzers.has(name);
  }

  clear(): void {
    this.analyzers.clear();
  }
}

export const registry = new AnalyzerRegistry();

// Register initial core analyzers
registry.register(PodAnalyzer);
registry.register(DeploymentAnalyzer);
registry.register(ServiceAnalyzer);
registry.register(PersistentVolumeClaimAnalyzer);
registry.register(NodeAnalyzer);

export {
  PodAnalyzer,
  DeploymentAnalyzer,
  ServiceAnalyzer,
  PersistentVolumeClaimAnalyzer,
  NodeAnalyzer,
};

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerAnalyzeCommand } from '../commands/analyze';
import { runAnalysis } from '../analysis/analysis';

vi.mock('../analysis/analysis', () => ({
  runAnalysis: vi.fn(async () => ({
    errors: [],
    status: 'OK',
    problems: 0,
    results: [],
  })),
}));

vi.mock('../ui/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(function (this: any) { return this; }),
    stop: vi.fn(),
    fail: vi.fn(),
  })),
}));

describe('analyze command', () => {
  let program: Command;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerAnalyzeCommand(program);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes Kubernetes analysis options to runAnalysis', async () => {
    await program.parseAsync([
      'node',
      'test',
      'analyze',
      '--namespace',
      'default',
      '--selector',
      'app=api',
      '--filter',
      'Pod',
      '--filter',
      'Deployment',
      '--output',
      'json',
      '--max-concurrency',
      '3',
      '--with-stat',
      '--with-doc',
      '--kubeconfig',
      '/tmp/kubeconfig',
      '--kubecontext',
      'minikube',
    ]);

    expect(runAnalysis).toHaveBeenCalledWith({
      filters: ['Pod', 'Deployment'],
      namespace: 'default',
      labelSelector: 'app=api',
      output: 'json',
      maxConcurrency: 3,
      withStats: true,
      withDocs: true,
      kubeconfig: '/tmp/kubeconfig',
      kubecontext: 'minikube',
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"status": "OK"'));
  });

  it('reports invalid output formats', async () => {
    await program.parseAsync(['node', 'test', 'analyze', '--output', 'yaml']);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Output format must be either'));
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });
});


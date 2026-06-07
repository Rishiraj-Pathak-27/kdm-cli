import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerAuthCommand } from '../commands/auth';
import { getAIConfig, setAIConfig } from '../config/store';
import { createAIClient } from '../ai/factory';

const { mockStore } = vi.hoisted(() => ({
  mockStore: { providers: [] as any[], defaultProvider: undefined as string | undefined }
}));

vi.mock('../config/store', () => ({
  getAIConfig: vi.fn(() => mockStore),
  setAIConfig: vi.fn((config) => {
    mockStore.providers = config.providers;
    mockStore.defaultProvider = config.defaultProvider;
  }),
}));

describe('auth command & AI clients', () => {
  let program: Command;
  let logSpy: any;
  let errorSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setAIConfig({ providers: [], defaultProvider: undefined });

    program = new Command();
    registerAuthCommand(program);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('adds a provider with defaults', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'mykey']);
    const config = getAIConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toEqual(
      expect.objectContaining({
        name: 'openai',
        model: 'gpt-4o',
        password: 'mykey',
        temperature: 0.7,
      }),
    );
    expect(config.defaultProvider).toBe('openai');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added AI provider "openai"'),
    );
  });

  it('rejects duplicate providers on add', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key2']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already configured'));
    expect(process.exitCode).toBe(1);
  });

  it('updates an existing provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync([
      'node',
      'test',
      'auth',
      'update',
      'openai',
      '-m',
      'gpt-4-turbo',
      '-p',
      'newkey',
    ]);
    const config = getAIConfig();
    expect(config.providers[0].model).toBe('gpt-4-turbo');
    expect(config.providers[0].password).toBe('newkey');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully updated AI provider "openai"'),
    );
  });

  it('lists providers and masks secrets', async () => {
    await program.parseAsync([
      'node',
      'test',
      'auth',
      'add',
      '--backend',
      'openai',
      '--password',
      'supersecretapikey',
    ]);
    await program.parseAsync(['node', 'test', 'auth', 'list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('openai'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('supe...ikey'));
  });

  it('sets a default provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'anthropic', '-p', 'key2']);
    await program.parseAsync(['node', 'test', 'auth', 'default', 'anthropic']);
    const config = getAIConfig();
    expect(config.defaultProvider).toBe('anthropic');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully set default AI provider to "anthropic"'),
    );
  });

  it('removes a provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'remove', 'openai']);
    const config = getAIConfig();
    expect(config.providers).toHaveLength(0);
    expect(config.defaultProvider).toBeUndefined();
  });

  it('creates Noop client and returns deterministic text', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'noop']);
    const client = await createAIClient('noop');
    expect(client.name).toBe('noop');
    const result = await client.getCompletion('test prompt');
    expect(result).toBe('noop completion explanation');
  });

  it('queries Custom REST provider', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ response: 'custom response text' }),
    } as Response);

    await program.parseAsync([
      'node',
      'test',
      'auth',
      'add',
      '-b',
      'customrest',
      '-u',
      'http://custom-endpoint.com/api',
    ]);
    const client = await createAIClient('customrest');
    const result = await client.getCompletion('custom prompt');
    expect(result).toBe('custom response text');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://custom-endpoint.com/api',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"prompt":"custom prompt"'),
      }),
    );
  });

  it('queries Ollama provider', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ response: 'ollama response text' }),
    } as Response);

    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'ollama']);
    const client = await createAIClient('ollama');
    const result = await client.getCompletion('ollama prompt');
    expect(result).toBe('ollama response text');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"prompt":"ollama prompt"'),
      }),
    );
  });

  it('queries OpenAI provider', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'openai reply' } }] }),
    } as Response);

    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'opensecretkey']);
    const client = await createAIClient('openai');
    const result = await client.getCompletion('hello gpt');
    expect(result).toBe('openai reply');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer opensecretkey',
        }),
      }),
    );
  });

  it('queries Anthropic provider', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: 'claude response' }] }),
    } as Response);

    await program.parseAsync([
      'node',
      'test',
      'auth',
      'add',
      '-b',
      'anthropic',
      '-p',
      'anthropicsecretkey',
    ]);
    const client = await createAIClient('anthropic');
    const result = await client.getCompletion('hello claude');
    expect(result).toBe('claude response');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'anthropicsecretkey',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });
});

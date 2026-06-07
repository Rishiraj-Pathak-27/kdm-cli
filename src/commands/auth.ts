import { Command } from 'commander';
import chalk from 'chalk';
import { getAIConfig, setAIConfig } from '../config/store';
import { type AIProviderConfig } from '../config/schema';

const VALID_BACKENDS = new Set(['openai', 'ollama', 'anthropic', 'noop', 'customrest']);

/**
 * Helper to collect multiple custom header flags from the CLI options into an array.
 * @param value The newly passed header.
 * @param previous Accumulator list of previously collected headers.
 * @returns Array containing all collected headers.
 */
const collectHeaders = (value: string, previous: string[]): string[] => [...previous, value];

/**
 * Validates the backend name against the supported list.
 * @param backend The provider backend name.
 * @returns The normalized backend name.
 * @throws Error if backend is invalid.
 */
const validateBackend = (backend: string): string => {
  const normalized = backend.toLowerCase();
  if (!VALID_BACKENDS.has(normalized)) {
    throw new Error(
      `Unsupported backend "${backend}". Supported: ${Array.from(VALID_BACKENDS).join(', ')}`,
    );
  }
  return normalized;
};

/**
 * Parses raw Key=Value header strings into a Record object.
 * @param headers String list of headers.
 * @returns Formatted headers record.
 */
const parseCustomHeaders = (headers: string[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const h of headers) {
    const parts = h.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      result[key] = val;
    }
  }
  return result;
};

/**
 * Masks secrets/API keys to avoid leaking them in plain text display.
 * @param secret Stored secret key.
 * @returns Masked representation.
 */
const maskSecret = (secret?: string): string => {
  if (!secret) return '(not set)';
  if (secret.length <= 8) return '********';
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
};

/**
 * Resolves default model name for a provider backend if not explicitly provided.
 * @param backend Normalized backend name.
 * @returns The default model name.
 */
const getDefaultModel = (backend: string): string => {
  if (backend === 'openai') return 'gpt-4o';
  if (backend === 'anthropic') return 'claude-3-5-sonnet-latest';
  if (backend === 'ollama') return 'llama3.1';
  return 'default';
};

/**
 * Adds a new AI provider to the store.
 * @param options CLI parsed option flags.
 */
const handleAuthAdd = (options: any): void => {
  let backend: string;
  try {
    backend = validateBackend(options.backend || 'openai');
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const aiConfig = getAIConfig();
  const exists = aiConfig.providers.some((p) => p.name.toLowerCase() === backend);
  if (exists) {
    console.error(
      chalk.red(
        `Error: Provider "${backend}" is already configured. Use "kdm auth update ${backend}" instead.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const model = options.model || getDefaultModel(backend);
  const customHeaders = options.customHeader?.length
    ? parseCustomHeaders(options.customHeader)
    : undefined;

  const provider: AIProviderConfig = {
    name: backend,
    model,
    password: options.password,
    baseUrl: options.baseurl,
    temperature: options.temperature ? Number.parseFloat(options.temperature) : 0.7,
    topP: options.topp ? Number.parseFloat(options.topp) : 1,
    topK: options.topk ? Number.parseInt(options.topk, 10) : 50,
    maxTokens: options.maxtokens ? Number.parseInt(options.maxtokens, 10) : 2048,
    customHeaders,
  };

  aiConfig.providers.push(provider);
  if (!aiConfig.defaultProvider) {
    aiConfig.defaultProvider = backend;
  }

  setAIConfig(aiConfig);
  console.log(chalk.green(`Successfully added AI provider "${backend}".`));
};

/**
 * Assigns non-undefined CLI flags to a provider configuration.
 * @param provider Config to update.
 * @param options CLI flags.
 */
const assignProviderUpdateOptions = (provider: AIProviderConfig, options: any): void => {
  if (options.model) provider.model = options.model;
  if (options.password !== undefined) provider.password = options.password;
  if (options.baseurl !== undefined) provider.baseUrl = options.baseurl;
  if (options.temperature !== undefined) {
    provider.temperature = Number.parseFloat(options.temperature);
  }
  if (options.topp !== undefined) provider.topP = Number.parseFloat(options.topp);
  if (options.topk !== undefined) provider.topK = Number.parseInt(options.topk, 10);
  if (options.maxtokens !== undefined) {
    provider.maxTokens = Number.parseInt(options.maxtokens, 10);
  }
  if (options.customHeader?.length) {
    provider.customHeaders = parseCustomHeaders(options.customHeader);
  }
};

/**
 * Updates an existing AI provider in the store.
 * @param backend Name of the backend to update.
 * @param options CLI parsed option flags.
 */
const handleAuthUpdate = (backend: string, options: any): void => {
  let normalizedBackend: string;
  try {
    normalizedBackend = validateBackend(backend);
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const aiConfig = getAIConfig();
  const idx = aiConfig.providers.findIndex(
    (p) => p.name.toLowerCase() === normalizedBackend,
  );

  if (idx === -1) {
    console.error(
      chalk.red(
        `Error: AI provider "${backend}" is not configured. Use "kdm auth add" to add it first.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  assignProviderUpdateOptions(aiConfig.providers[idx], options);
  setAIConfig(aiConfig);
  console.log(chalk.green(`Successfully updated AI provider "${normalizedBackend}".`));
};

/**
 * Lists the configured AI providers.
 */
const handleAuthList = (): void => {
  const aiConfig = getAIConfig();
  if (aiConfig.providers.length === 0) {
    console.log('No AI providers configured.');
    return;
  }

  console.log(chalk.bold('Configured AI Providers:'));
  aiConfig.providers.forEach((p) => {
    const isDefault = aiConfig.defaultProvider?.toLowerCase() === p.name.toLowerCase();
    const defaultMarker = isDefault ? chalk.green(' (default)') : '';
    console.log(`- ${chalk.blue.bold(p.name)}${defaultMarker}:`);
    console.log(`    Model:       ${p.model}`);
    console.log(`    Password:    ${maskSecret(p.password)}`);
    console.log(`    Base URL:    ${p.baseUrl || '(default)'}`);
    console.log(`    Temperature: ${p.temperature ?? 0.7}`);
    console.log(`    TopP:        ${p.topP ?? 1}`);
    console.log(`    TopK:        ${p.topK ?? 50}`);
    console.log(`    MaxTokens:   ${p.maxTokens ?? 2048}`);
  });
};

/**
 * Sets the default AI provider.
 * @param backend Name of the backend.
 */
const handleAuthDefault = (backend: string): void => {
  let normalizedBackend: string;
  try {
    normalizedBackend = validateBackend(backend);
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const aiConfig = getAIConfig();
  const exists = aiConfig.providers.some((p) => p.name.toLowerCase() === normalizedBackend);
  if (!exists) {
    console.error(
      chalk.red(
        `Error: AI provider "${backend}" is not configured. Configure it first using "kdm auth add".`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  aiConfig.defaultProvider = normalizedBackend;
  setAIConfig(aiConfig);
  console.log(chalk.green(`Successfully set default AI provider to "${normalizedBackend}".`));
};

/**
 * Removes an AI provider.
 * @param backend Name of the backend.
 */
const handleAuthRemove = (backend: string): void => {
  let normalizedBackend: string;
  try {
    normalizedBackend = validateBackend(backend);
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const aiConfig = getAIConfig();
  const exists = aiConfig.providers.some((p) => p.name.toLowerCase() === normalizedBackend);
  if (!exists) {
    console.error(chalk.red(`Error: AI provider "${backend}" is not configured.`));
    process.exitCode = 1;
    return;
  }

  aiConfig.providers = aiConfig.providers.filter(
    (p) => p.name.toLowerCase() !== normalizedBackend,
  );

  if (aiConfig.defaultProvider?.toLowerCase() === normalizedBackend) {
    aiConfig.defaultProvider = aiConfig.providers.length > 0 ? aiConfig.providers[0].name : undefined;
  }

  setAIConfig(aiConfig);
  console.log(chalk.green(`Successfully removed AI provider "${normalizedBackend}".`));
};

/**
 * Registers the auth subcommands on the Commander program.
 * @param program Commander program instance.
 */
export const registerAuthCommand = (program: Command): void => {
  const auth = program
    .command('auth')
    .description('Manage AI provider authentication and credentials');

  auth
    .command('add')
    .description('Add authentication details for an AI provider backend')
    .option(
      '-b, --backend <backend>',
      'AI backend provider (openai, ollama, anthropic, noop, customrest)',
      'openai',
    )
    .option(
      '-m, --model <model>',
      'AI model to use (defaults: openai=gpt-4o, anthropic=claude-3-5-sonnet-latest, ollama=llama3.1)',
    )
    .option('-p, --password <password>', 'API Key or password for the provider')
    .option('-u, --baseurl <baseurl>', 'Custom API Base URL')
    .option('-t, --temperature <temperature>', 'Sampling temperature')
    .option('--topp <topp>', 'Top-P value')
    .option('--topk <topk>', 'Top-K value')
    .option('--maxtokens <maxtokens>', 'Maximum tokens to generate')
    .option('--custom-header <header>', 'Custom request headers in Key=Value format', collectHeaders, [])
    .action(handleAuthAdd);

  auth
    .command('list')
    .description('List configured AI providers with masked secrets')
    .action(handleAuthList);

  auth
    .command('default <backend>')
    .description('Set the default AI provider backend')
    .action(handleAuthDefault);

  auth
    .command('remove <backend>')
    .description('Remove configuration for an AI provider backend')
    .action(handleAuthRemove);

  auth
    .command('update <backend>')
    .description('Update configuration details for an AI provider backend')
    .option('-m, --model <model>', 'AI model to use')
    .option('-p, --password <password>', 'API Key or password for the provider')
    .option('-u, --baseurl <baseurl>', 'Custom API Base URL')
    .option('-t, --temperature <temperature>', 'Sampling temperature')
    .option('--topp <topp>', 'Top-P value')
    .option('--topk <topk>', 'Top-K value')
    .option('--maxtokens <maxtokens>', 'Maximum tokens to generate')
    .option('--custom-header <header>', 'Custom request headers in Key=Value format', collectHeaders, [])
    .action(handleAuthUpdate);
};

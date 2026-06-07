import { AIClient } from './types';
import { OpenAIAIClient } from './openai';
import { AnthropicAIClient } from './anthropic';
import { OllamaAIClient } from './ollama';
import { CustomRestAIClient } from './custom-rest';
import { NoopAIClient } from './noop';
import { getAIConfig } from '../config/store';

const CLIENT_MAPPING: Record<string, new () => AIClient> = {
  openai: OpenAIAIClient,
  anthropic: AnthropicAIClient,
  ollama: OllamaAIClient,
  customrest: CustomRestAIClient,
  'custom-rest': CustomRestAIClient,
  noop: NoopAIClient,
};

/**
 * Instantiates and configures the appropriate AIClient based on the backend name.
 * Looks up stored configuration credentials.
 * @param backendName The name of the AI provider backend (e.g. 'openai', 'ollama').
 * @returns Instantiated and configured AIClient.
 */
export async function createAIClient(backendName: string): Promise<AIClient> {
  const aiConfig = getAIConfig();
  const providerConfig = aiConfig.providers.find(
    (p) => p.name.toLowerCase() === backendName.toLowerCase(),
  );

  const ClientClass = CLIENT_MAPPING[backendName.toLowerCase()];
  if (!ClientClass) {
    throw new Error(`Unsupported AI provider: ${backendName}`);
  }

  const client = new ClientClass();
  const activeConfig = providerConfig || { name: backendName, model: '' };
  await client.configure(activeConfig);
  return client;
}

import { AIClient } from './types';
import { OpenAIAIClient } from './openai';
import { AnthropicAIClient } from './anthropic';
import { OllamaAIClient } from './ollama';
import { CustomRestAIClient } from './custom-rest';
import { NoopAIClient } from './noop';
import { getAIConfig } from '../config/store';

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

  let client: AIClient;

  switch (backendName.toLowerCase()) {
    case 'openai':
      client = new OpenAIAIClient();
      break;
    case 'anthropic':
      client = new AnthropicAIClient();
      break;
    case 'ollama':
      client = new OllamaAIClient();
      break;
    case 'customrest':
    case 'custom-rest':
      client = new CustomRestAIClient();
      break;
    case 'noop':
      client = new NoopAIClient();
      break;
    default:
      throw new Error(`Unsupported AI provider: ${backendName}`);
  }

  const activeConfig = providerConfig || { name: backendName, model: '' };
  await client.configure(activeConfig);
  return client;
}

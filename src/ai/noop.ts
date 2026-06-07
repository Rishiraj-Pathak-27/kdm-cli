import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for testing purposes returning deterministic responses.
 */
export class NoopAIClient implements AIClient {
  readonly name = 'noop';

  /**
   * Configures the Noop client.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    // No-op
  }

  /**
   * Generates a deterministic test completion.
   * @param prompt The string prompt.
   * @returns A fixed response string.
   */
  async getCompletion(prompt: string): Promise<string> {
    return 'noop completion explanation';
  }
}

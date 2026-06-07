import { AIProviderConfig } from '../config/schema';

/**
 * Interface representing a standardized AI provider client.
 */
export interface AIClient {
  /**
   * The name of the backend provider.
   */
  name: string;

  /**
   * Configures the client with the specified credentials and settings.
   * @param config The AI provider config options.
   */
  configure(config: AIProviderConfig): Promise<void>;

  /**
   * Generates a text completion based on the given prompt.
   * @param prompt The string prompt to send to the provider.
   */
  getCompletion(prompt: string): Promise<string>;

  /**
   * Optional clean up operation when the client is closed.
   */
  close?(): Promise<void>;
}

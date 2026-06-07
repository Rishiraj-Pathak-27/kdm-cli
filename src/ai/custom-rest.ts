import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation sending prompts to a configurable REST endpoint.
 */
export class CustomRestAIClient implements AIClient {
  readonly name = 'customrest';
  private config!: AIProviderConfig;

  /**
   * Configures the client, ensuring a baseUrl is specified.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    if (!config.baseUrl) {
      throw new Error('baseUrl is required for customrest provider');
    }
    this.config = config;
  }

  /**
   * Sends prompt data to the custom REST API endpoint.
   * @param prompt The string prompt.
   * @returns The resolved completion response.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = this.config.baseUrl!;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders,
    };

    if (this.config.password) {
      headers['Authorization'] = `Bearer ${this.config.password}`;
    }

    const body = {
      prompt,
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      topP: this.config.topP ?? 1,
      topK: this.config.topK ?? 50,
      maxTokens: this.config.maxTokens ?? 2048,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Custom REST API call failed with status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    // Support common JSON response fields for simple prompt completions
    return data.completion || data.response || data.text || JSON.stringify(data);
  }
}

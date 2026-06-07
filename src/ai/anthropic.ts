import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for querying Anthropic Claude models.
 */
export class AnthropicAIClient implements AIClient {
  readonly name = 'anthropic';
  private config!: AIProviderConfig;

  /**
   * Configures the client, ensuring the Anthropic API key is provided.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com/v1/messages',
      model: config.model || 'claude-3-5-sonnet-latest',
    };
    if (!this.config.password) {
      throw new Error('API key (password) is required for anthropic provider');
    }
  }

  /**
   * Sends a message request to the Anthropic messages API.
   * @param prompt The string prompt.
   * @returns The generated response string.
   */
  async getCompletion(prompt: string): Promise<string> {
    let url = this.config.baseUrl!;
    if (url.endsWith('/v1') || url.endsWith('/v1/')) {
      url = url.replace(/\/$/, '') + '/messages';
    } else if (!url.includes('/messages')) {
      url = url.replace(/\/$/, '') + '/messages';
    }

    const body = {
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.config.maxTokens ?? 2048,
      temperature: this.config.temperature ?? 0.7,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.password!,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API call failed with status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return data.content?.[0]?.text || '';
  }
}

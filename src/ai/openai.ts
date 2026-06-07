import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for querying OpenAI compatible APIs.
 */
export class OpenAIAIClient implements AIClient {
  readonly name = 'openai';
  private config!: AIProviderConfig;

  /**
   * Configures the client, ensuring the API key is set.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1/chat/completions',
      model: config.model || 'gpt-4o',
    };
    if (!this.config.password) {
      throw new Error('API key (password) is required for openai provider');
    }
  }

  /**
   * Sends a chat completion query to the OpenAI API.
   * @param prompt The string prompt.
   * @returns The generated response string.
   */
  async getCompletion(prompt: string): Promise<string> {
    let url = this.config.baseUrl!;
    if (url.endsWith('/v1') || url.endsWith('/v1/')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    } else if (!url.includes('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }

    const body = {
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature ?? 0.7,
      top_p: this.config.topP ?? 1,
      max_tokens: this.config.maxTokens ?? 2048,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.password}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API call failed with status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

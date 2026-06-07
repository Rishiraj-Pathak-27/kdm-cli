import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * Formats the standard OpenAI URL based on user custom base url configuration.
 * @param baseUrl User configured base URL or undefined.
 * @returns Formatted completions URL.
 */
const formatOpenAIUrl = (baseUrl?: string): string => {
  const base = baseUrl || 'https://api.openai.com/v1/chat/completions';
  const url = base.replace(/\/$/, '');
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }
  if (!url.includes('/chat/completions')) {
    return `${url}/chat/completions`;
  }
  return url;
};

/**
 * Builds the OpenAI payload body.
 * @param model Model name.
 * @param prompt Prompt text.
 * @param temp Temperature.
 * @param topP TopP.
 * @param maxTokens MaxTokens.
 * @returns Payload body object.
 */
const buildOpenAIBody = (
  model: string,
  prompt: string,
  temp?: number,
  topP?: number,
  maxTokens?: number,
) => ({
  model,
  messages: [{ role: 'user', content: prompt }],
  temperature: temp ?? 0.7,
  top_p: topP ?? 1,
  max_tokens: maxTokens ?? 2048,
});

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
    const url = formatOpenAIUrl(this.config.baseUrl);
    const body = buildOpenAIBody(
      this.config.model,
      prompt,
      this.config.temperature,
      this.config.topP,
      this.config.maxTokens,
    );

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.password}`,
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

export type TaskKind =
  | 'enhance'
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'fix_grammar'
  | 'generate'
  | 'review'
  | 'translate';

export interface AIProviderConfig {
  maxTokens: number;
  temperature: number;
  /** Per-request timeout in ms. Falls back to the provider's default. */
  timeoutMs?: number;
}

export interface AIStreamResult {
  [Symbol.asyncIterator](): AsyncIterator<string>;
  usage: TokenUsage;
  model: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIProvider {
  readonly id: string;
  generate(
    system: string,
    user: string,
    config: AIProviderConfig,
  ): Promise<{ text: string; usage: TokenUsage; model: string }>;
  stream(system: string, user: string, config: AIProviderConfig): Promise<AIStreamResult>;
}

export const TASK_CONFIG: Record<TaskKind, AIProviderConfig> = {
  enhance: { maxTokens: 1024, temperature: 0.2 },
  rewrite: { maxTokens: 1024, temperature: 0.3 },
  shorten: { maxTokens: 512, temperature: 0.2 },
  expand: { maxTokens: 1536, temperature: 0.4 },
  fix_grammar: { maxTokens: 1024, temperature: 0.1 },
  generate: { maxTokens: 512, temperature: 0.6 },
  review: { maxTokens: 2048, temperature: 0.3, timeoutMs: 90_000 },
  translate: { maxTokens: 2048, temperature: 0.2 },
};

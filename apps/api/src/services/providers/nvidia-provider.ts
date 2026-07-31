import { createAIProvider } from './ai-provider-factory.js';
import type { AIProvider } from '../ai-provider.js';

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

export function createNvidiaProvider(apiKey: string): AIProvider {
  return createAIProvider({
    baseUrl: NVIDIA_URL,
    model: NVIDIA_MODEL,
    apiKey,
    id: 'nvidia',
    enableJsonMode: 'auto',
  });
}

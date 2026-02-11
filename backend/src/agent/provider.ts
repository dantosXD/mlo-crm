import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getEnv } from '../config/env.js';
import type { LanguageModel } from 'ai';

export interface AgentProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

/**
 * Read AI config from environment.
 * AI_API_KEY takes precedence; falls back to OPENAI_API_KEY for backward compat.
 */
export function getAgentConfig(): AgentProviderConfig {
  const env = getEnv();
  return {
    provider: env.AI_PROVIDER ?? 'openai',
    model: env.AI_MODEL ?? 'gpt-4o',
    apiKey: env.AI_API_KEY || env.OPENAI_API_KEY || '',
    baseUrl: env.AI_BASE_URL ?? '',
    modelName: env.AI_MODEL_NAME ?? '',
  };
}

let _cachedModel: LanguageModel | null = null;
let _cachedConfigHash: string | null = null;

function configHash(cfg: AgentProviderConfig): string {
  return `${cfg.provider}:${cfg.model}:${cfg.apiKey}:${cfg.baseUrl}:${cfg.modelName}`;
}

/**
 * Resolve the configured provider + model into an AI SDK LanguageModel.
 * Result is cached as a singleton (config is static from env).
 *
 * Supported providers:
 *  - openai          → OpenAI (GPT-4o, GPT-4o-mini, o1, etc.)
 *  - anthropic       → Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
 *  - google          → Google (Gemini 2.0, etc.)
 *  - openai-compatible → Any OpenAI-compatible API: Ollama, LM Studio, vLLM,
 *                        Together AI, Groq, Fireworks, local servers, etc.
 *                        Set AI_BASE_URL to the server endpoint.
 */
export function resolveModel(config?: AgentProviderConfig): LanguageModel {
  const cfg = config ?? getAgentConfig();
  const hash = configHash(cfg);

  if (_cachedModel && _cachedConfigHash === hash) {
    return _cachedModel;
  }

  let model: LanguageModel;

  switch (cfg.provider) {
    case 'openai': {
      const provider = createOpenAI({ apiKey: cfg.apiKey });
      model = provider(cfg.model);
      break;
    }

    case 'anthropic': {
      const provider = createAnthropic({ apiKey: cfg.apiKey });
      model = provider(cfg.model);
      break;
    }

    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey: cfg.apiKey });
      model = provider(cfg.model);
      break;
    }

    case 'openai-compatible': {
      if (!cfg.baseUrl) {
        throw new Error(
          'AI_BASE_URL is required for openai-compatible provider. ' +
            'Set it to your local LLM endpoint (e.g. http://localhost:11434/v1 for Ollama).'
        );
      }

      const provider = createOpenAICompatible({
        name: 'custom-llm',
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey || 'not-needed',
      });

      const modelId = cfg.modelName || cfg.model;
      model = provider.chatModel(modelId);
      break;
    }

    default:
      throw new Error(
        `Unknown AI_PROVIDER "${cfg.provider}". ` +
          'Supported: openai, anthropic, google, openai-compatible'
      );
  }

  _cachedModel = model;
  _cachedConfigHash = hash;
  return model;
}

/**
 * Check whether the AI agent is configured and usable.
 */
export function isAgentConfigured(): { ok: boolean; reason?: string } {
  const cfg = getAgentConfig();

  if (cfg.provider === 'openai-compatible') {
    if (!cfg.baseUrl) {
      return { ok: false, reason: 'AI_BASE_URL is required for local/compatible LLMs.' };
    }
    return { ok: true };
  }

  if (!cfg.apiKey) {
    return {
      ok: false,
      reason: `AI_API_KEY (or OPENAI_API_KEY) is required for the "${cfg.provider}" provider.`,
    };
  }

  return { ok: true };
}

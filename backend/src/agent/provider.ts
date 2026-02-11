import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
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

/**
 * Resolve the configured provider + model into an AI SDK LanguageModel.
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

  switch (cfg.provider) {
    case 'openai': {
      if (cfg.apiKey) {
        process.env.OPENAI_API_KEY = cfg.apiKey;
      }
      return openai(cfg.model) as LanguageModel;
    }

    case 'anthropic': {
      if (cfg.apiKey) {
        process.env.ANTHROPIC_API_KEY = cfg.apiKey;
      }
      return anthropic(cfg.model) as LanguageModel;
    }

    case 'google': {
      if (cfg.apiKey) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = cfg.apiKey;
      }
      return google(cfg.model) as LanguageModel;
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
        apiKey: cfg.apiKey || 'not-needed', // local LLMs often don't require a key
      });

      const modelId = cfg.modelName || cfg.model;
      return provider.chatModel(modelId) as LanguageModel;
    }

    default:
      throw new Error(
        `Unknown AI_PROVIDER "${cfg.provider}". ` +
          'Supported: openai, anthropic, google, openai-compatible'
      );
  }
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

import { z } from 'zod';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  FRONTEND_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/mlo_dashboard?schema=public'),
  JWT_SECRET: z.string().min(1).default('dev-secret-key-change-in-production-min-32-chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('refresh_token'),
  ENCRYPTION_KEY: z.string().min(32).default('default-encryption-key-32-bytes-min'),
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  WEBHOOK_REPLAY_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  WORKER_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(3540),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_BUCKET: z.string().min(1).default('mlo-documents'),
  S3_ACCESS_KEY: z.string().min(1).default('minio'),
  S3_SECRET_KEY: z.string().min(1).default('minio123'),
  REDIS_URL: z.union([z.literal(''), z.string().url()]).default(''),
  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_ENVIRONMENT: z.string().optional().default('development'),
  SENTRY_RELEASE: z.string().optional().default(''),
  // AI Agent Configuration — provider-agnostic
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'openai-compatible']).optional().default('openai'),
  AI_MODEL: z.string().optional().default('gpt-4o'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default(''), // For local LLMs (Ollama, LM Studio, vLLM, etc.)
  AI_MODEL_NAME: z.string().optional().default(''), // Override model name for openai-compatible providers
  OPENAI_API_KEY: z.string().optional().default(''), // Deprecated: use AI_API_KEY instead (kept for backward compat)
  CALENDAR_OAUTH_ENABLED: z.coerce.boolean().default(false),
  CALENDAR_OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  CALENDAR_OAUTH_TEST_MODE: z.coerce.boolean().default(false),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional().default(''),
  MICROSOFT_OAUTH_CLIENT_ID: z.string().optional().default(''),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  MICROSOFT_OAUTH_REDIRECT_URI: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().optional().default(''),
  PASSWORD_RESET_SMTP_ENABLED: z.coerce.boolean().default(false),
});

export type AppEnv = z.infer<typeof baseEnvSchema>;

function validateProductionEnv(env: AppEnv): AppEnv {
  if (env.NODE_ENV !== 'production') {
    return env;
  }

  const requiredInProduction: Array<keyof AppEnv> = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'REDIS_URL',
    'FRONTEND_URL',
  ];

  if (env.CALENDAR_OAUTH_ENABLED) {
    requiredInProduction.push(
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REDIRECT_URI',
      'MICROSOFT_OAUTH_CLIENT_ID',
      'MICROSOFT_OAUTH_CLIENT_SECRET',
      'MICROSOFT_OAUTH_REDIRECT_URI',
    );
  }

  if (env.PASSWORD_RESET_SMTP_ENABLED) {
    requiredInProduction.push('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM');
  }

  const missing = requiredInProduction.filter((key) => !String(env[key] ?? '').trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    );
  }

  return env;
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = baseEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = validateProductionEnv(parsed.data);
  return cachedEnv;
}

import { z } from 'zod';

function toServerList(value) {
  if (value === 'none') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().optional().default(''),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    AI_CONCURRENCY: z.coerce.number().int().positive().default(2),
    APPEAL_WINDOW_DAYS: z.coerce.number().int().positive().default(14),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Comma-separated DNS servers used only if a mongodb+srv lookup fails locally. "none" disables it.
    DNS_FALLBACK: z.string().default('1.1.1.1,8.8.8.8').transform(toServerList),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER !== 'gemini') return;
    if (!env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'required when AI_PROVIDER=gemini',
      });
    }
    if (!env.GEMINI_MODEL) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_MODEL'],
        message: 'required when AI_PROVIDER=gemini',
      });
    }
  });

// Unset values and inline "# comments" from .env files are treated as missing.
function cleanEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.replace(/\s+#.*$/, '').trim();
    if (trimmed !== '') out[key] = trimmed;
  }
  return out;
}

function loadConfig() {
  const parsed = EnvSchema.safeParse(cleanEnv(process.env));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return Object.freeze(parsed.data);
}

export const config = loadConfig();
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

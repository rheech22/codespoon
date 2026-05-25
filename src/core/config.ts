import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

export const ConfigSchema = z.object({
  knowledge_dir: z.string().default('docs/knowledge'),
  state_dir: z.string().default('.codespoon'),
  max_node_chars: z.number().default(12000),
  retry_count: z.number().default(3),
  ignore: z.array(z.string()).default([
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
  ]),
  generated_paths: z.array(z.string()).default(['src/api/**']),
  agent: z.object({
    cli: z.string().default('opencode'),
    model: z.string().default('openai/gpt-5.5'),
    invoke_timeout_seconds: z.number().default(300),
  }).default({}),
  vcs: z.object({
    driver: z.string().default('git'),
  }).default({}),
  framework_adapters: z.array(z.string()).default(['next-app-router']),
});
export type CodespoonConfig = z.infer<typeof ConfigSchema>;

export const DEFAULTS = ConfigSchema.parse({});

export interface ConfigLoadError {
  type: 'not-found' | 'parse-error' | 'validation-error';
  message: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfigStrict(dir: string): CodespoonConfig {
  const { config, error } = loadConfig(dir);
  if (error && error.type !== 'not-found') {
    throw new ConfigError(error.message);
  }
  return config;
}

export function loadConfig(dir: string): { config: CodespoonConfig; error?: ConfigLoadError } {
  const configPath = resolve(dir, 'codespoon.config.yaml');
  if (!existsSync(configPath)) {
    return { config: { ...DEFAULTS }, error: { type: 'not-found', message: 'Config file not found, using defaults' } };
  }
  const raw = readFileSync(configPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    return {
      config: { ...DEFAULTS },
      error: { type: 'parse-error', message: `Invalid YAML in config: ${(err as Error).message}` },
    };
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const lines = result.error.issues.map(i =>
      `  - ${i.path.join('.')}: ${i.message}`,
    ).join('\n');
    return {
      config: { ...DEFAULTS },
      error: { type: 'validation-error', message: `Invalid config:\n${lines}` },
    };
  }

  return { config: result.data };
}

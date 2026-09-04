import { config as loadDotenv } from 'dotenv';

// Nothing in this project read the .env file: the application takes values
// straight from process.env, and no loader ran before it. Every setting
// therefore fell back to its default, and .env.example described a
// configuration that was never applied.
loadDotenv();

/**
 * Validates the environment before the application starts. A missing or
 * malformed value fails here, loudly, instead of somewhere deep inside a
 * library - or, worse, silently falling back to a default that is published
 * in this repository.
 */
/**
 * jsonwebtoken types `expiresIn` as its own string union ('15m', '7d', …)
 * rather than a plain string, so the values are declared that way once here
 * instead of being cast with `as any` at each call site.
 */
type ExpiresIn = NonNullable<import('@nestjs/jwt').JwtSignOptions['expiresIn']>;

export interface EnvConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRATION: ExpiresIn;
  JWT_REFRESH_EXPIRATION: ExpiresIn;
  CORS_ORIGINS: string;
  SWAGGER_ENABLED: boolean;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  STUN_URLS: string;
  TURN_HOST?: string;
  TURN_STATIC_AUTH_SECRET?: string;
  TURN_TTL_SECONDS: number;
}

function readBoolean(
  raw: string | undefined,
  key: string,
  fallback: boolean,
  errors: string[],
) {
  if (raw === undefined || raw === '') return fallback;
  if (raw !== 'true' && raw !== 'false') {
    errors.push(`${key}: expected "true" or "false", got "${raw}"`);
    return fallback;
  }
  // Comparing the string: Boolean('false') is true.
  return raw === 'true';
}

function readNumber(
  raw: string | undefined,
  key: string,
  fallback: number,
  errors: string[],
) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${key}: expected a positive integer, got "${raw}"`);
    return fallback;
  }
  return value;
}

let cached: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (cached) return cached;

  const errors: string[] = [];
  const env = process.env;

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV: expected development, test or production');
  }
  const isProduction = nodeEnv === 'production';

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) {
    errors.push(
      'JWT_SECRET: required, at least 32 characters. Generate one with ' +
        '`openssl rand -hex 32`. There is deliberately no default: a shared ' +
        'fallback secret lets anyone sign their own admin token.',
    );
  }

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    errors.push('DATABASE_URL: required, for example file:./dev.db');
  }

  const corsOrigins = env.CORS_ORIGINS ?? '';
  if (isProduction && corsOrigins.trim() === '') {
    errors.push(
      'CORS_ORIGINS: required in production, a comma-separated list of origins',
    );
  }

  // A relay is optional - without one, calls fall back to STUN - but half a
  // configuration is a mistake worth catching at startup.
  const turnHost = env.TURN_HOST ?? '';
  const turnSecret = env.TURN_STATIC_AUTH_SECRET ?? '';
  if (Boolean(turnHost) !== Boolean(turnSecret)) {
    errors.push(
      'TURN_HOST and TURN_STATIC_AUTH_SECRET: set both or neither. The secret ' +
        'must match `static-auth-secret` in the coturn configuration.',
    );
  }
  if (turnSecret && turnSecret.length < 32) {
    errors.push('TURN_STATIC_AUTH_SECRET: at least 32 characters');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  cached = {
    NODE_ENV: nodeEnv as EnvConfig['NODE_ENV'],
    PORT: readNumber(env.PORT, 'PORT', 3000, errors),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_EXPIRATION: (env.JWT_ACCESS_EXPIRATION ?? '15m') as ExpiresIn,
    JWT_REFRESH_EXPIRATION: (env.JWT_REFRESH_EXPIRATION ?? '7d') as ExpiresIn,
    CORS_ORIGINS: corsOrigins,
    SWAGGER_ENABLED: readBoolean(
      env.SWAGGER_ENABLED,
      'SWAGGER_ENABLED',
      false,
      errors,
    ),
    THROTTLE_TTL: readNumber(env.THROTTLE_TTL, 'THROTTLE_TTL', 60000, errors),
    THROTTLE_LIMIT: readNumber(
      env.THROTTLE_LIMIT,
      'THROTTLE_LIMIT',
      100,
      errors,
    ),
    STUN_URLS:
      env.STUN_URLS ??
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
    TURN_HOST: turnHost || undefined,
    TURN_STATIC_AUTH_SECRET: turnSecret || undefined,
    TURN_TTL_SECONDS: readNumber(
      env.TURN_TTL_SECONDS,
      'TURN_TTL_SECONDS',
      3600,
      errors,
    ),
  };

  return cached;
}

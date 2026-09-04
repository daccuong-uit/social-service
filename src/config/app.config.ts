import 'dotenv/config';
import { loadConfig, BaseEnvSchema } from '@platform/config';
import { z } from 'zod';

const SocialEnvSchema = BaseEnvSchema.extend({
  PORT: z.coerce.number().default(3004),
  SOCIAL_SERVICE_PORT: z.coerce.number().default(3004),
  DATABASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('*'),
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().optional(),
}).transform((data) => ({
  ...data,
  PORT: data.SOCIAL_SERVICE_PORT || data.PORT,
}));

export const appConfig = loadConfig(SocialEnvSchema);
export type AppConfig = typeof appConfig;

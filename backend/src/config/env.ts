import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_B2C_SHORTCODE: z.string().optional(),
  MPESA_INITIATOR_NAME: z.string().optional(),
  MPESA_INITIATOR_PASSWORD: z.string().optional(),
  MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_BASE_URL: z.string().default('https://sandbox.safaricom.co.ke'),
  MPESA_CALLBACK_URL: z.string().optional(),
  PESALINK_CLIENT_ID: z.string().optional(),
  PESALINK_CLIENT_SECRET: z.string().optional(),
  PESALINK_BASE_URL: z.string().optional(),
  JENGA_API_KEY: z.string().optional(),
  JENGA_MERCHANT_CODE: z.string().optional(),
  JENGA_CONSUMER_SECRET: z.string().optional(),
  JENGA_BASE_URL: z.string().optional(),
  KCB_CLIENT_ID: z.string().optional(),
  KCB_CLIENT_SECRET: z.string().optional(),
  KCB_BASE_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('KenyaPay <noreply@kenyapay.co.ke>'),
  AT_API_KEY: z.string().optional(),
  AT_USERNAME: z.string().default('sandbox'),
  AT_SENDER_ID: z.string().default('KENYAPAY'),
  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_PASSWORD: z.string().min(8),
  PLATFORM_NAME: z.string().default('KenyaPay Platform'),
  MAX_FILE_SIZE_MB: z.string().default('10'),
  UPLOAD_PATH: z.string().default('./uploads'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  REDIS_PORT: parseInt(parsed.data.REDIS_PORT, 10),
  REDIS_DB: parseInt(parsed.data.REDIS_DB, 10),
  SMTP_PORT: parseInt(parsed.data.SMTP_PORT, 10),
  SMTP_SECURE: parsed.data.SMTP_SECURE === 'true',
  MAX_FILE_SIZE_MB: parseInt(parsed.data.MAX_FILE_SIZE_MB, 10),
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
};

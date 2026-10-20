import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database (PostgreSQL / Supabase)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CLIENT_ORIGIN: z.string().min(1, 'CLIENT_ORIGIN is required'),

  // Supabase Storage + admin auth (required for vault routes)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Email (optional)
  EMAIL_API_KEY: z.string().optional(),
  CONTACT_FROM_EMAIL: z.string().email().optional(),
  CONTACT_TO_EMAIL: z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));

  // In development, allow missing non-critical vars (e.g. email).
  // In production, hard fail.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Build env object — use parsed.data when valid, fall back to process.env for dev resilience
const data = parsed.success ? parsed.data : process.env;

export const env = {
  // Core
  NODE_ENV: data.NODE_ENV || 'development',
  PORT: Number(data.PORT) || 3001,

  // Database + CORS
  DATABASE_URL: data.DATABASE_URL || '',
  CLIENT_ORIGIN: data.CLIENT_ORIGIN || 'http://localhost:5173',

  // Supabase (Storage + admin auth)
  SUPABASE_URL: data.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: data.SUPABASE_SERVICE_ROLE_KEY || '',

  // Email (optional)
  EMAIL_API_KEY: data.EMAIL_API_KEY || '',
  CONTACT_FROM_EMAIL: data.CONTACT_FROM_EMAIL || '',
  CONTACT_TO_EMAIL: data.CONTACT_TO_EMAIL || '',
  emailConfigured: Boolean(
    data.EMAIL_API_KEY &&
      data.CONTACT_FROM_EMAIL &&
      data.CONTACT_TO_EMAIL
  ),

  // Helper flags
  supabaseConfigured: Boolean(data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE_KEY),
};

// Debug log (dev only)
if (env.NODE_ENV === 'development') {
  console.log('🔧 Environment loaded:');
  console.log('   NODE_ENV:', env.NODE_ENV);
  console.log('   PORT:', env.PORT);
  console.log('   DATABASE_URL:', env.DATABASE_URL ? '✅ set' : '❌ missing');
  console.log('   CLIENT_ORIGIN:', env.CLIENT_ORIGIN);
  console.log('   SUPABASE_URL:', env.SUPABASE_URL ? '✅ set' : '❌ missing');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing');
  console.log('   Email configured:', env.emailConfigured ? '✅ yes' : '⚠️ no (optional)');
}
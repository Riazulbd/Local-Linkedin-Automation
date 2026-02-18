import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getServerSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function createClient() {
  const cookieStore = cookies();
  const supabaseUrl = getServerSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: Record<string, unknown>) => cookieStore.set({ name, value, ...options }),
        remove: (name: string, options: Record<string, unknown>) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  );
}

export function createServiceClient() {
  const supabaseUrl = getServerSupabaseUrl();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return createServerClient(
    supabaseUrl,
    serviceRole,
    { cookies: { get: () => '', set: () => {}, remove: () => {} } }
  );
}

export const BANGLADESH_TIMEZONE = 'Asia/Dhaka';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

// Use bracket-based env reads to avoid build-time inlining in Dockerized Next builds.
export const BUN_SERVER_URL =
  readEnv('BUN_SERVER_URL') ||
  readEnv('NEXT_PUBLIC_BUN_SERVER_URL') ||
  'http://localhost:3001';

export const BUN_SERVER_SECRET =
  readEnv('BUN_SERVER_SECRET') ||
  readEnv('BUN_SECRET') ||
  '';

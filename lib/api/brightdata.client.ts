export interface ProxyCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
}

export function formatProxyUrl(creds: ProxyCredentials): string {
  return `http://${creds.username}:${creds.password}@${creds.host}:${creds.port}`;
}

export function formatPlaywrightProxy(creds: ProxyCredentials) {
  return {
    server: `http://${creds.host}:${creds.port}`,
    username: creds.username,
    password: creds.password,
  };
}

export async function testProxyConnection(creds: ProxyCredentials): Promise<{
  success: boolean;
  ip?: string;
  isp?: string;
  country?: string;
  error?: string;
}> {
  return { success: false, error: 'Call via Bun server API' };
}

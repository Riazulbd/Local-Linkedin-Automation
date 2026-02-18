interface AdsPowerBrowserStartResponse {
  code: number;
  msg?: string;
  data?: {
    ws?: {
      playwright?: string;
      puppeteer?: string;
    };
  };
}

interface AdsPowerBrowserStopResponse {
  code: number;
  msg?: string;
}

function getBaseUrl(): string {
  return process.env.ADSPOWER_BASE_URL || 'http://localhost:50325';
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = process.env.ADSPOWER_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`AdsPower request failed (${response.status})`);
  }

  return response.json();
}

export class AdsPowerManager {
  static async startProfile(profileId: string): Promise<{ wsEndpoint: string; profileId: string }> {
    const startParams = new URLSearchParams({
      user_id: profileId,
      open_tabs: process.env.ADSPOWER_OPEN_STARTUP_TABS || '0',
      ip_tab: process.env.ADSPOWER_OPEN_IP_TAB || '0',
    });

    const data = (await request(
      `/api/v1/browser/start?${startParams.toString()}`,
      { method: 'GET' }
    )) as AdsPowerBrowserStartResponse;

    if (data.code !== 0) {
      throw new Error(`AdsPower start failed: ${data.msg || 'unknown error'}`);
    }

    const wsEndpoint = data.data?.ws?.playwright || data.data?.ws?.puppeteer;
    if (!wsEndpoint) {
      throw new Error('AdsPower start response missing websocket endpoint');
    }

    return {
      wsEndpoint,
      profileId,
    };
  }

  static async stopProfile(profileId: string): Promise<void> {
    const data = (await request(
      `/api/v1/browser/stop?user_id=${encodeURIComponent(profileId)}`,
      { method: 'GET' }
    )) as AdsPowerBrowserStopResponse;

    if (data.code !== 0) {
      throw new Error(`AdsPower stop failed: ${data.msg || 'unknown error'}`);
    }
  }

  static async adsPowerCreateProfile(
    name: string,
    proxyHost?: string,
    proxyPort?: number,
    proxyUser?: string,
    proxyPass?: string
  ): Promise<string> {
    const body: Record<string, any> = {
      name,
      group_id: '0',
      user_proxy_config: proxyHost
        ? {
            proxy_soft: 'brightdata',
            proxy_type: 'http',
            proxy_host: proxyHost,
            proxy_port: String(proxyPort || ''),
            proxy_user: proxyUser,
            proxy_password: proxyPass,
          }
        : { proxy_soft: 'no_proxy' },
      fingerprint_config: {
        automatic_timezone: '1',
        language: ['en-US', 'en'],
        resolution: '1920_1080',
        fonts: ['random'],
        canvas: '1',
        webgl: '1',
        audio: '1',
      },
    };

    const data = await request('/api/v1/user/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (data.code !== 0) {
      throw new Error(`AdsPower create profile failed: ${data.msg || 'unknown error'}`);
    }

    return String(data.data?.id || '');
  }
}

export { request as adsPowerRequest };

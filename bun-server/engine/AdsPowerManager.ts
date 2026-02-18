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

interface AdsPowerBrowserActiveResponse {
  code: number;
  msg?: string;
  data?: {
    status?: string;
  };
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
  private static lastStartRequestAt = 0;

  private static async cooldownStartRequests(): Promise<void> {
    const minIntervalMs = 1200;
    const elapsed = Date.now() - AdsPowerManager.lastStartRequestAt;
    if (elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }
    AdsPowerManager.lastStartRequestAt = Date.now();
  }

  private static async getActiveState(profileId: string): Promise<string> {
    try {
      const data = (await request(
        `/api/v1/browser/active?user_id=${encodeURIComponent(profileId)}`,
        { method: 'GET' }
      )) as AdsPowerBrowserActiveResponse;
      return data.data?.status || data.msg || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private static async tryStart(
    profileId: string,
    openTabs: string,
    ipTab: string
  ): Promise<AdsPowerBrowserStartResponse> {
    const params = new URLSearchParams({
      user_id: profileId,
      open_tabs: openTabs,
      ip_tab: ipTab,
    });
    await AdsPowerManager.cooldownStartRequests();
    return (await request(`/api/v1/browser/start?${params.toString()}`, {
      method: 'GET',
    })) as AdsPowerBrowserStartResponse;
  }

  static async startProfile(profileId: string): Promise<{ wsEndpoint: string; profileId: string }> {
    const startVariants = [
      {
        openTabs: process.env.ADSPOWER_OPEN_STARTUP_TABS || '0',
        ipTab: process.env.ADSPOWER_OPEN_IP_TAB || '0',
      },
      { openTabs: '0', ipTab: '0' },
      { openTabs: '1', ipTab: '0' },
    ];

    let lastMsg = 'unknown error';
    let lastCode = -1;

    for (const variant of startVariants) {
      const data = await AdsPowerManager.tryStart(
        profileId,
        variant.openTabs,
        variant.ipTab
      ).catch((error) => {
        lastMsg = error instanceof Error ? error.message : String(error);
        return null;
      });

      if (!data) {
        continue;
      }

      if (data.code === 0) {
        const wsEndpoint = data.data?.ws?.playwright || data.data?.ws?.puppeteer;
        if (!wsEndpoint) {
          throw new Error('AdsPower start response missing websocket endpoint');
        }

        return {
          wsEndpoint,
          profileId,
        };
      }

      lastCode = data.code;
      lastMsg = data.msg || 'unknown error';

      // AdsPower rate-limits start endpoint; back off and retry variant list.
      if (lastMsg.toLowerCase().includes('too many request')) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Attempt stale-session cleanup between retries.
      await AdsPowerManager.stopProfile(profileId).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const activeState = await AdsPowerManager.getActiveState(profileId);

    throw new Error(
      `AdsPower start failed (code=${lastCode}): ${lastMsg}. active=${activeState}. ` +
        'Open the profile manually in AdsPower to verify local kernel health (AdsPower Error 100001).'
    );
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

import { chromium } from 'playwright';

interface ProxyTestPayload {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface ProxyGeoResponse {
  ip?: string;
  country?: string;
  org?: string;
  asn?: {
    asn?: number;
    org_name?: string;
  };
}

export async function runProxyTest(payload: ProxyTestPayload) {
  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: `http://${payload.host}:${payload.port}`,
      username: payload.username,
      password: payload.password,
    },
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto('https://lumtest.com/myip.json', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    if (!response) {
      return { success: false, error: 'No response received from proxy target' };
    }

    const bodyText = await response.text();
    const parsed = JSON.parse(bodyText) as ProxyGeoResponse;

    return {
      success: true,
      ip: parsed.ip,
      country: parsed.country,
      isp: parsed.asn?.org_name || parsed.org,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Proxy test failed',
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}


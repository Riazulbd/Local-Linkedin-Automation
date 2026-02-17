const ADSPOWER_BASE = process.env.ADSPOWER_BASE_URL || 'http://localhost:50325';
const ADSPOWER_KEY = process.env.ADSPOWER_API_KEY || '';

interface AdsPowerStartResult {
  wsEndpoint: string;
  profileId: string;
}

interface AdsPowerProfile {
  id: string;
  name: string;
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ADSPOWER_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ADSPOWER_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`AdsPower API ${path} failed: ${res.status}`);
  return res.json();
}

export async function adsPowerStartProfile(profileId: string): Promise<AdsPowerStartResult> {
  const data = await request(`/api/v1/browser/start?user_id=${profileId}`);
  if (data.code !== 0) throw new Error(`AdsPower: ${data.msg}`);
  const wsEndpoint = data.data?.ws?.puppeteer;
  if (!wsEndpoint) throw new Error('AdsPower returned no WebSocket endpoint');
  return { wsEndpoint, profileId };
}

export async function adsPowerStopProfile(profileId: string): Promise<void> {
  await request(`/api/v1/browser/stop?user_id=${profileId}`);
}

export async function adsPowerListProfiles(): Promise<AdsPowerProfile[]> {
  const data = await request(`/api/v1/user/list?page=1&page_size=100`);
  return (data.data?.list ?? []).map((p: Record<string, unknown>) => ({ id: p.user_id, name: p.name }));
}

export async function adsPowerIsReachable(): Promise<boolean> {
  try {
    await fetch(`${ADSPOWER_BASE}/status`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

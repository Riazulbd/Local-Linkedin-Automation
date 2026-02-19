import type { Locator, Page } from 'playwright';

export type ConnectionDegree = '1st' | '2nd' | '3rd' | 'pending' | 'not_connected' | 'unknown';

export interface ConnectionState {
  degree: ConnectionDegree;
  canMessage: boolean;
  canConnect: boolean;
  shouldFollow: boolean;
  displayName: string;
}

async function getProfileHeader(page: Page): Promise<Locator | null> {
  const selectors = [
    '.pv-top-card',
    'div.ph5.pb5',
    '.scaffold-layout__main .pv-text-details__left-panel',
  ];

  for (const selector of selectors) {
    try {
      const container = page.locator(selector).first();
      if (await container.isVisible({ timeout: 1500 })) {
        return container;
      }
    } catch {
      // continue
    }
  }

  return null;
}

async function isVisible(root: Page | Locator, selector: string, timeout: number): Promise<boolean> {
  return root
    .locator(selector)
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

export async function detectConnectionState(page: Page): Promise<ConnectionState> {
  console.log('[ConnectionDetector] Reading profile connection state (scoped)');

  const header = await getProfileHeader(page);
  const scopedRoot = header ?? page;

  const nameSelectors = [
    'h1.inline.t-24',
    'h1[class*="inline"][class*="t-24"]',
    '.text-heading-xlarge',
  ];

  let displayName = 'Unknown';
  for (const selector of nameSelectors) {
    try {
      const node = scopedRoot.locator(selector).first();
      const text = (await node.textContent({ timeout: 1200 }))?.trim();
      if (!text) continue;
      displayName = text;
      break;
    } catch {
      // continue
    }
  }

  let degree: ConnectionDegree = 'unknown';
  const degreeSelectors = [
    '.dist-value',
    '[data-test-connection-degree]',
    'span:has-text("connection")',
    'li:has-text("connection")',
  ];

  for (const selector of degreeSelectors) {
    try {
      const node = scopedRoot.locator(selector).first();
      const text = (await node.textContent({ timeout: 1200 }))?.toLowerCase() ?? '';
      if (!text) continue;

      if (text.includes('1st')) {
        degree = '1st';
        break;
      }
      if (text.includes('2nd')) {
        degree = '2nd';
        break;
      }
      if (text.includes('3rd')) {
        degree = '3rd';
        break;
      }
    } catch {
      // continue
    }
  }

  if (degree === 'unknown' && (await isVisible(scopedRoot, 'button:has-text("Pending")', 600))) {
    degree = 'pending';
  }

  if (
    degree === 'unknown' &&
    (await isVisible(scopedRoot, 'button[aria-label*="Invite" i]', 600)) &&
    !(await isVisible(scopedRoot, 'button:has-text("Message")', 400))
  ) {
    degree = 'not_connected';
  }

  if (degree === 'unknown' && (await isVisible(scopedRoot, 'button:has-text("Message")', 600))) {
    degree = '1st';
  }

  const canMessage = degree === '1st';
  const canConnect = degree === '2nd' || degree === '3rd' || degree === 'not_connected';
  const shouldFollow = degree === '3rd';

  return {
    degree,
    canMessage,
    canConnect,
    shouldFollow,
    displayName,
  };
}

export async function updateLeadConnectionState(
  supabase: any,
  leadId: string,
  state: ConnectionState
): Promise<void> {
  const { data } = await supabase
    .from('leads')
    .select('extra_data')
    .eq('id', leadId)
    .maybeSingle();

  const currentExtra =
    data && typeof data === 'object' && (data as Record<string, unknown>).extra_data
      ? ((data as Record<string, unknown>).extra_data as Record<string, unknown>)
      : {};

  const nextExtra = {
    ...currentExtra,
    connection_degree: state.degree,
    can_message: state.canMessage,
    can_connect: state.canConnect,
    should_follow: state.shouldFollow,
    profile_name: state.displayName,
  };

  await supabase
    .from('leads')
    .update({
      connection_degree: state.degree,
      extra_data: nextExtra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

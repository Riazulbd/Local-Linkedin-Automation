import type { Page } from 'playwright';

export type ConnectionDegree = '1st' | '2nd' | '3rd' | 'pending' | 'not_connected' | 'unknown';

export async function detectConnectionState(page: Page): Promise<ConnectionDegree> {
  const degreeBadgeSelectors = [
    '.dist-value',
    '[data-test-connection-degree]',
    '.pv-top-card--list-bullet li',
  ];

  for (const selector of degreeBadgeSelectors) {
    try {
      const badge = page.locator(selector).first();
      const text = (await badge.textContent({ timeout: 2000 })) || '';
      if (!text) continue;

      if (text.includes('1st')) return '1st';
      if (text.includes('2nd')) return '2nd';
      if (text.includes('3rd')) return '3rd';
    } catch {
      // continue trying selectors
    }
  }

  const pendingBtn = page.locator('button:has-text("Pending")').first();
  if (await pendingBtn.isVisible({ timeout: 1000 }).catch(() => false)) return 'pending';

  const connectBtn = page.locator('button:has-text("Connect")').first();
  if (await connectBtn.isVisible({ timeout: 1000 }).catch(() => false)) return 'not_connected';

  const messageBtn = page.locator('button:has-text("Message")').first();
  if (await messageBtn.isVisible({ timeout: 1000 }).catch(() => false)) return '1st';

  return 'unknown';
}

export async function updateLeadConnectionState(
  supabase: any,
  leadId: string,
  state: ConnectionDegree
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
    connection_degree: state,
  };

  await supabase
    .from('leads')
    .update({
      connection_degree: state,
      extra_data: nextExtra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

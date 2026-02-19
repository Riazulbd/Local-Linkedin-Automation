import type { Page } from 'playwright';
import type { ActionResult } from '../../../types';
import { dismissPopups } from '../helpers/linkedinGuard';
import { detectConnectionState } from '../helpers/connectionDetector';

export async function checkConnection(
  page: Page,
  _lead?: { id?: string }
): Promise<ActionResult & { isConnected: boolean }> {
  await dismissPopups(page);
  const state = await detectConnectionState(page);
  const is1st = state.degree === '1st';

  return {
    success: true,
    isConnected: is1st,
    action: is1st ? 'connected' : 'not_connected',
    data: { status: state.degree, connectionState: state },
  };
}
